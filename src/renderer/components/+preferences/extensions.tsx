/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import type { IComputedValue } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import type { RegisteredAppPreference } from "./app-preferences/app-preference-registration";
import { ExtensionSettings } from "./extension-settings";
import { Preferences } from "./preferences";
import extensionsPreferenceItemsInjectable from "./extension-preference-items.injectable";
import currentPathParametersInjectable from "../../routes/current-path-parameters.injectable";
import rendererExtensionsInjectable from "../../../extensions/renderer-extensions.injectable";

interface Dependencies {
  preferenceItems: IComputedValue<RegisteredAppPreference[]>;
  extensionName: string;
}

const NonInjectedExtensions = ({ preferenceItems, extensionName }: Dependencies) => (
  <Preferences data-testid="extension-preferences-page">
    <section id="extensions">
      <h2>{extensionName} preferences</h2>
      {preferenceItems.get().map((preferenceItem, index) => (
        <ExtensionSettings
          key={`${preferenceItem.id}-${index}`}
          setting={preferenceItem}
          size="small"
          data-testid={`extension-preference-item-for-${preferenceItem.id}`}
        />
      ))}
    </section>
  </Preferences>
);

export const Extensions = withInjectables<Dependencies>(
  observer(NonInjectedExtensions),

  {
    getProps: (di) => {
      const pathParameters = di.inject(currentPathParametersInjectable);
      const extensionId = pathParameters.get().extensionId;
      const extensions = di.inject(rendererExtensionsInjectable);
      const extension = extensions.get().find((extension) => extension.sanitizedExtensionId === extensionId);

      return {
        preferenceItems: di.inject(extensionsPreferenceItemsInjectable, extensionId),
        extensionName: extension?.manifest.name,
      };
    },
  },
);
