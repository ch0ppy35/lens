/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import path from "path";
import normalizedPlatformArchitecture from "./normalized-platform-architecture.injectable";
import bundledResourcesDirectoryInjectable from "./bundled-resources-dir.injectable";

const baseBundeledBinariesDirectoryInjectable = getInjectable({
  id: "base-bundeled-binaries-directory",
  instantiate: (di) => path.join(
    di.inject(bundledResourcesDirectoryInjectable),
    di.inject(normalizedPlatformArchitecture),
  ),
});

export default baseBundeledBinariesDirectoryInjectable;
