/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectionToken } from "@ogre-tools/injectable";
import type { IComputedValue } from "mobx";
import type { IpcValue } from "../channel/allowed-types";

export interface SyncBox<TValue extends IpcValue> {
  id: string;
  value: IComputedValue<TValue>;
  set: (value: TValue) => void;
}

export const syncBoxInjectionToken = getInjectionToken<SyncBox<any>>({
  id: "sync-box",
});
