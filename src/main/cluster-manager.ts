/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import "../common/cluster-ipc";
import type http from "http";
import { ipcMain } from "electron";
import { action, autorun, makeObservable, reaction } from "mobx";
import { ClusterStore, getClusterIdFromHost } from "../common/cluster-store";
import type { Cluster } from "./cluster";
import logger from "./logger";
import { apiKubePrefix } from "../common/vars";
import { Singleton, toJS } from "../common/utils";
import { catalogEntityRegistry } from "./catalog";
import { KubernetesCluster } from "../common/catalog-entities/kubernetes-cluster";

export class ClusterManager extends Singleton {
  private store = ClusterStore.getInstance();

  constructor() {
    super();
    makeObservable(this);

    this.disposers.push(
      reaction(
        () => toJS(this.store.clustersList),
        clusters => this.updateCatalog(clusters),
        { fireImmediately: true },
      ),
      reaction(
        () => catalogEntityRegistry.getItemsForApiKind<KubernetesCluster>("entity.k8slens.dev/v1alpha1", "KubernetesCluster"),
        entities => this.syncClustersFromCatalog(entities)
      ),
      // auto-stop removed clusters
      autorun(() => {
        const removedClusters = Array.from(this.store.removedClusters.values());

        if (removedClusters.length > 0) {
          const meta = removedClusters.map(cluster => cluster.getMeta());

          logger.info(`[CLUSTER-MANAGER]: removing clusters`, meta);
          removedClusters.forEach(cluster => cluster.disconnect());
          this.store.removedClusters.clear();
        }
      }, {
        delay: 250
      }),
      () => {
        for (const cluster of this.store.clusters.values()) {
          cluster.disconnect();
        }
      }
    );

    ipcMain.on("network:offline", this.onNetworkOffline);
    ipcMain.on("network:online", this.onNetworkOnline);
  }

  @action
  protected updateCatalog(clusters: Cluster[]) {
    for (const cluster of clusters) {
      const index = catalogEntityRegistry.items.findIndex((entity) => entity.metadata.uid === cluster.id);

      if (index !== -1) {
        const entity = catalogEntityRegistry.items[index];

        entity.status.phase = cluster.disconnected ? "disconnected" : "connected";
        entity.status.active = !cluster.disconnected;

        if (cluster.preferences?.clusterName) {
          entity.metadata.name = cluster.preferences.clusterName;
        }

        entity.spec.metrics ??= { source: "local" };

        if (entity.spec.metrics.source === "local") {
          entity.spec.metrics.prometheus ??= {};
          entity.spec.metrics.prometheus.type ??= cluster.preferences.prometheusProvider?.type;
          entity.spec.metrics.prometheus.address = cluster.preferences.prometheus;
        }

        catalogEntityRegistry.items.splice(index, 1, entity);
      }
    }
  }

  @action syncClustersFromCatalog(entities: KubernetesCluster[]) {
    for (const entity of entities) {
      const cluster = this.store.getById(entity.metadata.uid);

      if (!cluster) {
        this.store.addCluster({
          id: entity.metadata.uid,
          preferences: {
            clusterName: entity.metadata.name
          },
          kubeConfigPath: entity.spec.kubeconfigPath,
          contextName: entity.spec.kubeconfigContext
        });
      } else {
        cluster.kubeConfigPath = entity.spec.kubeconfigPath;
        cluster.contextName = entity.spec.kubeconfigContext;

        entity.status = {
          phase: cluster.disconnected ? "disconnected" : "connected",
          active: !cluster.disconnected
        };
      }
    }
  }

  protected onNetworkOffline = () => {
    logger.info("[CLUSTER-MANAGER]: network is offline");
    this.store.clustersList.forEach((cluster) => {
      if (!cluster.disconnected) {
        cluster.online = false;
        cluster.accessible = false;
        cluster.refreshConnectionStatus().catch((e) => e);
      }
    });
  };

  protected onNetworkOnline = () => {
    logger.info("[CLUSTER-MANAGER]: network is online");
    this.store.clustersList.forEach((cluster) => {
      if (!cluster.disconnected) {
        cluster.refreshConnectionStatus().catch((e) => e);
      }
    });
  };

  getClusterForRequest(req: http.IncomingMessage): Cluster {
    let cluster: Cluster = null;

    // lens-server is connecting to 127.0.0.1:<port>/<uid>
    if (req.headers.host.startsWith("127.0.0.1")) {
      const clusterId = req.url.split("/")[1];

      cluster = this.store.getById(clusterId);

      if (cluster) {
        // we need to swap path prefix so that request is proxied to kube api
        req.url = req.url.replace(`/${clusterId}`, apiKubePrefix);
      }
    } else if (req.headers["x-cluster-id"]) {
      cluster = this.store.getById(req.headers["x-cluster-id"].toString());
    } else {
      const clusterId = getClusterIdFromHost(req.headers.host);

      cluster = this.store.getById(clusterId);
    }

    return cluster;
  }
}

export function catalogEntityFromCluster(cluster: Cluster) {
  return new KubernetesCluster({
    metadata: {
      uid: cluster.id,
      name: cluster.name,
      source: "local",
      labels: {
        distro: cluster.distribution,
      }
    },
    spec: {
      kubeconfigPath: cluster.kubeConfigPath,
      kubeconfigContext: cluster.contextName
    },
    status: {
      phase: cluster.disconnected ? "disconnected" : "connected",
      reason: "",
      message: "",
      active: !cluster.disconnected
    }
  });
}
