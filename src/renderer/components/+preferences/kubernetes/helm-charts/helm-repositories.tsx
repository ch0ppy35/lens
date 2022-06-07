/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import styles from "./helm-charts.module.scss";

import React from "react";

import { observer } from "mobx-react";
import activeHelmRepositoriesInjectable from "./active-helm-repositories.injectable";
import type { IAsyncComputed } from "@ogre-tools/injectable-react";
import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "../../../spinner";
import type { HelmRepo } from "../../../../../common/helm-repo";
import { RemovableItem } from "../../removable-item";
import deactivateHelmRepositoryInjectable from "./deactivate-helm-repository.injectable";

interface Dependencies {
  activeHelmRepositories: IAsyncComputed<HelmRepo[]>;
  deactivateRepository: (repository: HelmRepo) => Promise<void>;
}

const NonInjectedActiveHelmRepositories = observer(({ activeHelmRepositories, deactivateRepository }: Dependencies) => {
  if (activeHelmRepositories.pending.get()) {
    return (
      <div className={styles.repos}>
        <div className="pt-5 relative">
          <Spinner center data-testid="helm-repositories-are-loading" />
        </div>
      </div>
    );
  }

  const repositories = activeHelmRepositories.value.get();

  return (
    <div className={styles.repos}>
      {repositories.map((repository) => (
        <RemovableItem
          key={repository.name}
          onRemove={() => deactivateRepository(repository)}
          className="mt-3"
          data-testid={`deactivate-helm-repository-${repository.name}`}
        >
          <div data-testid={`helm-repository-${repository.name}`} className={styles.repoName}>
            {repository.name}
          </div>

          <div className={styles.repoUrl}>{repository.url}</div>
        </RemovableItem>
      ))}
    </div>
  );

});

export const HelmRepositories = withInjectables<Dependencies>(
  NonInjectedActiveHelmRepositories,

  {
    getProps: (di) => ({
      activeHelmRepositories: di.inject(activeHelmRepositoriesInjectable),
      deactivateRepository: di.inject(deactivateHelmRepositoryInjectable),
    }),
  },
);

