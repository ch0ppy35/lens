/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { routeInjectionToken } from "../../routes/all-routes.injectable";

const extensionsRouteInjectable = getInjectable({
  id: "extensions-route",

  instantiate: () => ({
    path: "/extensions",
    clusterFrame: false,
    isEnabled: computed(() => true),
  }),

  injectionToken: routeInjectionToken,
});

export default extensionsRouteInjectable;