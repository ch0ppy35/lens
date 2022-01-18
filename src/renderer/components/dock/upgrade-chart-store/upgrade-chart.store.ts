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

import { action, autorun, computed, IReactionDisposer, reaction, makeObservable } from "mobx";
import { DockStore, DockTab, TabId, TabKind } from "../dock-store/dock.store";
import { DockTabStorageState, DockTabStore } from "../dock-tab-store/dock-tab.store";
import { getReleaseValues } from "../../../../common/k8s-api/endpoints/helm-releases.api";
import type { ReleaseStore } from "../../+apps-releases/release.store";
import { iter, StorageHelper } from "../../../utils";

export interface IChartUpgradeData {
  releaseName: string;
  releaseNamespace: string;
}

interface Dependencies {
  releaseStore: ReleaseStore
  valuesStore: DockTabStore<string>
  dockStore: DockStore
  createStorage: <T>(storageKey: string, options: DockTabStorageState<T>) => StorageHelper<DockTabStorageState<T>>
}

export class UpgradeChartStore extends DockTabStore<IChartUpgradeData> {
  private watchers = new Map<string, IReactionDisposer>();

  @computed private get releaseNameReverseLookup(): Map<string, string> {
    return new Map(iter.map(this.data, ([id, { releaseName }]) => [releaseName, id]));
  }

  get values() {
    return this.dependencies.valuesStore;
  }

  constructor(protected dependencies : Dependencies) {
    super(dependencies, {
      storageKey: "chart_releases",
    });

    makeObservable(this);

    autorun(() => {
      const { selectedTab, isOpen } = dependencies.dockStore;

      if (selectedTab?.kind === TabKind.UPGRADE_CHART && isOpen) {
        this.loadData(selectedTab.id);
      }
    }, { delay: 250 });

    autorun(() => {
      const objects = [...this.data.values()];

      objects.forEach(({ releaseName }) => this.createReleaseWatcher(releaseName));
    });
  }

  private createReleaseWatcher(releaseName: string) {
    if (this.watchers.get(releaseName)) {
      return;
    }
    const dispose = reaction(() => {
      const release = this.dependencies.releaseStore.getByName(releaseName);

      return release?.getRevision(); // watch changes only by revision
    },
    release => {
      const releaseTab = this.getTabByRelease(releaseName);

      if (!this.dependencies.releaseStore.isLoaded || !releaseTab) {
        return;
      }

      // auto-reload values if was loaded before
      if (release) {
        if (this.dependencies.dockStore.selectedTab === releaseTab && this.values.getData(releaseTab.id)) {
          this.loadValues(releaseTab.id);
        }
      }
      // clean up watcher, close tab if release not exists / was removed
      else {
        dispose();
        this.watchers.delete(releaseName);
        this.dependencies.dockStore.closeTab(releaseTab.id);
      }
    });

    this.watchers.set(releaseName, dispose);
  }

  isLoading(tabId = this.dependencies.dockStore.selectedTabId) {
    const values = this.values.getData(tabId);

    return !this.dependencies.releaseStore.isLoaded || values === undefined;
  }

  @action
  async loadData(tabId: TabId) {
    const values = this.values.getData(tabId);

    await Promise.all([
      !this.dependencies.releaseStore.isLoaded && this.dependencies.releaseStore.loadFromContextNamespaces(),
      !values && this.loadValues(tabId),
    ]);
  }

  @action
  async loadValues(tabId: TabId) {
    this.values.clearData(tabId); // reset
    const { releaseName, releaseNamespace } = this.getData(tabId);
    const values = await getReleaseValues(releaseName, releaseNamespace, true);

    this.values.setData(tabId, values);
  }

  getTabByRelease(releaseName: string): DockTab {
    return this.dependencies.dockStore.getTabById(this.releaseNameReverseLookup.get(releaseName));
  }
}