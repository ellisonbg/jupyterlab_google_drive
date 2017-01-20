// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  clearSignalData, defineSignal, ISignal
} from 'phosphor/lib/core/signaling';

import {
  JSONObject
} from 'phosphor/lib/algorithm/json';

import {
  IRealtime, IRealtimeHandler, IRealtimeModel,
  ISynchronizable, ICollaborator
} from 'jupyterlab/lib/realtime';

import {
  IObservableMap, ObservableMap
} from 'jupyterlab/lib/common/observablemap';

declare let gapi : any;

export
class CollaboratorMap implements IObservableMap<GoogleRealtimeCollaborator> {

  constructor(doc: gapi.drive.realtime.Document) {

    //Get the map with the collaborators, or
    //create it if it does not exist.
    let id = 'collaborators:map';
    this._doc = doc;
    this._map = doc.getModel().getRoot().get(id);

    //We need to create the map
    if(!this._map) {
      this._map = doc.getModel().createMap<GoogleRealtimeCollaborator>();
      doc.getModel().getRoot().set(id, this._map);
    }

    //Populate the map with its initial values.
    //Even if the map already exists, it is easy to miss
    //some collaborator events (if, for instance, the
    //realtime doc is not shut down properly).
    //This is an opportunity to refresh it.
    let initialCollaborators: any[] = doc.getCollaborators();

    //remove stale collaborators
    let initialSessions = new Set<string>();
    for(let i=0; i<initialCollaborators.length; i++) {
      initialSessions.add(initialCollaborators[i].sessionId);
    }
    for(let k of this._map.keys()) {
      if(!initialSessions.has(k)) {
        this._map.delete(k);
      }
    }
    //Now add the remaining collaborators
    for(let i=0; i<initialCollaborators.length; i++) {
      let collaborator = initialCollaborators[i];
      if(!this._map.has(collaborator.sessionId)) {
        this._map.set(collaborator.sessionId, {
          userId: collaborator.userId,
          sessionId: collaborator.sessionId,
          displayName: collaborator.displayName,
          color: collaborator.color,
          position: {}
        });
      }
    }

    //Add event listeners to the CollaboratorMap
    this._doc.addEventListener(
      gapi.drive.realtime.EventType.COLLABORATOR_JOINED,
      (evt : any) => {
        let collaborator = evt.collaborator;
        this.set(collaborator.sessionId, {
          userId: collaborator.userId,
          sessionId: collaborator.sessionId,
          displayName: collaborator.displayName,
          color: collaborator.color,
          position: {}
        });
      }
    );
    this._doc.addEventListener(
      gapi.drive.realtime.EventType.COLLABORATOR_LEFT,
      (evt : any) => {
        this.delete(evt.collaborator.sessionId);
      }
    );
  }
  /**
   * A signal emitted when the map has changed.
   */
  changed: ISignal<CollaboratorMap, ObservableMap.IChangedArgs<GoogleRealtimeCollaborator>>;

  /**
   * Get whether this map can be linked to another.
   *
   * @returns `false`,
   */
  readonly isLinkable: boolean = false;

  /**
   * The number of key-value pairs in the map.
   */
  get size(): number {
    return this._map.size;
  }

  /**
   * Whether this map has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Set a key-value pair in the map
   *
   * @param key - The key to set.
   *
   * @param value - The value for the key.
   *
   * @returns the old value for the key, or undefined
   *   if that did not exist.
   */
  set(key: string, value: GoogleRealtimeCollaborator): GoogleRealtimeCollaborator {
    let oldVal = this._map.get(key);
    this._map.set(key, value);
    this.changed.emit({
      type: oldVal ? 'change' : 'add',
      key: key,
      oldValue: oldVal,
      newValue: value
    });
    return oldVal;
      
  }

  /**
   * Get a value for a given key.
   *
   * @param key - the key.
   *
   * @returns the value for that key.
   */
  get(key: string): GoogleRealtimeCollaborator {
    return this._map.get(key);
  }

  /**
   * Check whether the map has a key.
   *
   * @param key - the key to check.
   *
   * @returns `true` if the map has the key, `false` otherwise.
   */
  has(key: string): boolean {
    return this._map.has(key);
  }

  /**
   * Get a list of the keys in the map.
   *
   * @returns - a list of keys.
   */
  keys(): string[] {
    return this._map.keys();
  }

  /**
   * Get a list of the values in the map.
   *
   * @returns - a list of values.
   */
  values(): GoogleRealtimeCollaborator[] {
    return this._map.values();
  }

  /**
   * Remove a key from the map
   *
   * @param key - the key to remove.
   *
   * @returns the value of the given key,
   *   or undefined if that does not exist. 
   */
  delete(key: string): GoogleRealtimeCollaborator {
    let oldVal = this._map.get(key);
    this._map.delete(key);
    this.changed.emit({
      type: 'remove',
      key: key,
      oldValue: oldVal,
      newValue: undefined
    });
    return oldVal;
  }

  /**
   * Link the map to another map.
   * Any changes to either are mirrored in the other.
   *
   * @param map: the parent map.
   */
  link(map: IObservableMap<GoogleRealtimeCollaborator>): void {
    //no-op
  }

  /**
   * Unlink the map from its parent map.
   */
  unlink(): void {
    //no-op
  }

  /**
   * Set the ObservableMap to an empty map.
   */
  clear(): void {
    this._map.clear();
  }

  /**
   * Dispose of the resources held by the map.
   */
  dispose(): void {
    if(this._isDisposed) {
      return;
    }
    clearSignalData(this);
    this._map.removeAllEventListeners();
    this._map.clear();
    this._map = null;
    this._isDisposed = true;
  }

  private _doc : gapi.drive.realtime.Document = null;
  private _map : gapi.drive.realtime.CollaborativeMap<GoogleRealtimeCollaborator> = null;
  private _isDisposed : boolean = false;
}

// Define the signal for the collaborator map.
defineSignal(CollaboratorMap.prototype, 'changed');

export
class GoogleRealtimeCollaborator implements ICollaborator {
  /**
   * A user id for the collaborator.
   * This might not be unique, if the user has more than
   * one editing session at a time.
   */
  readonly userId: string;

  /**
   * A session id, which should be unique to a
   * particular view on a collaborative model.
   */
  readonly sessionId: string;

  /**
   * A human-readable display name for a collaborator.
   */
  readonly displayName: string;

  /**
   * A color to be used to identify the collaborator in
   * UI elements.
   */
  readonly color: string;

  /**
   * A representation of the position of the collaborator
   * in the collaborative document. This can include, but
   * is not limited to, the cursor position. Different
   * widgets are responsible for setting/reading this value.
   */
  position: JSONObject;
}