import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Subscriber = (newVal: any) => void;

export class StorageListener<E extends string> {
  storageKey?: string;
  state: Record<E, any>;
  events: Map<E, Set<Subscriber>>;

  constructor(eventKeys: E[], storageKey?: string) {
    this.storageKey = storageKey;
    this.events = new Map(eventKeys.map((eventKey) => [eventKey, new Set()]));
    this.state = Object.fromEntries(eventKeys.map(key => [key]));
  }

  init(storageKey?: string) {
    if (storageKey != null) {
      this.storageKey = storageKey;
    }

    this.getStoredState();

    return this;
  }

  async getStoredState() {
    if (this.storageKey == null) {
      return;
    }

    try {
      const value = await AsyncStorage.getItem(this.storageKey);
      if (value) {
        this.state = JSON.parse(value);
        for (const [key, val] of Object.entries(this.state)) {
          if (!this.events.has(key as E)) {
            return;
          }

          for (const sub of this.events.get(key as E)!) {
            sub(val);
          }
        }
      }
    } catch (e) {
      throw Error(e);
    }
  }

  getValue(key: E) {
    return this.state[key];
  }

  subscribe(key: E, subscriber: Subscriber) {
    this.events.get(key)?.add(subscriber);

    return () => {
        this.events.get(key)?.delete(subscriber)
    };
  }

  update(key: E, value: any) {
    try {
      const newState = { ...this.state, [key]: value };
      const newStateString = JSON.stringify(newState);

      if (!this.events.has(key) || this.storageKey == null) {
          return;
      }

      for (const sub of this.events.get(key)!) {
        sub(value);
      }
      AsyncStorage.setItem(this.storageKey, newStateString);
      this.state = newState;
    } catch (e) {
      throw Error("Failed to update Async storage: " + e);
    }
  }
}

export function makeCreateStorage<E extends string>(
  storageListener: StorageListener<E>
) {
  return function createStorage<T>(key: E, defaultValue: T) {
    return function useStorage(): [T, (newval: T) => void] {
      const [state, setState] = React.useState<T>(
        storageListener.getValue(key) ?? defaultValue
      );

      React.useEffect(() => {
        return storageListener.subscribe(key, setState);
      });

      const setVal = React.useCallback((newVal: T) => {
        storageListener.update(key, newVal);
      }, []);

      return [state, setVal];
    }
  };
}