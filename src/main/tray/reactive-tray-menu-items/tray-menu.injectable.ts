/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import trayMenuItemsInjectable from "../tray-menu-item/tray-menu-items.injectable";
import buildMenuFromTemplateInjectable from "../../electron/build-from-template.injectable";
import convertToElectronMenuTemplateInjectable from "./convert-to-electron-menu-template.injectable";

const trayMenuInjectable = getInjectable({
  id: "tray-menu",
  instantiate: (di) => {
    const trayMenuItems = di.inject(trayMenuItemsInjectable);
    const convertToElectronMenuTemplate = di.inject(convertToElectronMenuTemplateInjectable);
    const buildMenuFromTemplate = di.inject(buildMenuFromTemplateInjectable);

    return computed(() => (
      buildMenuFromTemplate(
        convertToElectronMenuTemplate(
          trayMenuItems.get(),
        ),
      )
    ));
  },
});

export default trayMenuInjectable;
