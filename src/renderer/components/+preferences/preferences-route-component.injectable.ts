/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import { Preferences } from "./preferences";
import preferencesRouteInjectable from "./preferences-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";

const preferencesRouteComponentInjectable = getInjectable({
  id: "preferences-route-component",

  instantiate: (di) => ({
    route: di.inject(preferencesRouteInjectable),
    Component: Preferences,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default preferencesRouteComponentInjectable;