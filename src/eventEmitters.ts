import {EventEmitter} from "events";
import {BaseEntity} from "./BaseEntity";
import {IEvents, IEventsType} from "./types";

class EventEmitters {
    private _eventEmitters = new Map<object, any>();

    public getEventEmitter<R extends typeof BaseEntity>(target: R, create: boolean = false): IEvents<InstanceType<R>> {
        if (!this._eventEmitters.has(target) && create) {
            this._eventEmitters.set(target, new EventEmitter());
        }

        return this._eventEmitters.get(target) as IEvents<InstanceType<R>>;
    }

    public emit<T extends BaseEntity>(eventType: IEventsType, entity: T) {
        const eventEmitter = this.getEventEmitter(entity.constructor as any);
        if (eventEmitter) {
            setImmediate(() => eventEmitter.emit(eventType, entity));
        }
    }

}

export const eventEmitters = new EventEmitters();
