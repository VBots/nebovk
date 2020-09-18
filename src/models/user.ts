import { Context } from 'vk-io';
import { IProfilerPayload, Profiler } from '@vbots/primary-kit';

export interface IUserPayload extends IProfilerPayload {
    senderId?: number;
    data: any;
    sayme: any;
    promoData: any;
    gStore: any;
}

export interface IUserData {
    balance: number;
    checkpoints: {
        [key: string]: number;
    };
    email?: string;
    emailLock: boolean;
    wasInGroup: boolean;
}

export default class User extends Profiler {
    senderId: number;
    data: IUserData;
    sayme: any;
    promoData: any[];
    gStore: any[];

    constructor(context: Context, payload: IUserPayload) {
        super(context, payload);

        this.senderId = payload.senderId || context.isChat ? context.senderId : 0;

        this.data = payload.data || {
            email: false,
            balance: 0,
            emailLock: false,
            okFirst: {},
            wasInGroup: false,
        };

        if (this.isAdmin) {
            this.sayme = payload.sayme || {
                peer_id: false,
                sendInline: false,
            };
        }

        this.promoData = payload.promoData || [];
        this.gStore = payload.gStore || [];
    }

    /**
     * Serialize Profiler data
     */
    public SerializeData(): IUserPayload {
        return {
            senderId: this.senderId,
            data: this.data,
            sayme: this.sayme,
            promoData: this.promoData,
            gStore: this.gStore,

            ...super.SerializeData(),
        };
    }

    public get isAdmin() {
        return [191039467].includes(this.senderId);
    }

    public hasCheckpoint(name: string | any) {
        if (!this.data.checkpoints) {
            this.data.checkpoints = {};
        }

        return this.data.checkpoints[name] !== undefined;
    }

    public reachCheckpoint(name: string | any) {
        if (!this.hasCheckpoint(name)) {
            this.data.checkpoints[name] = Date.now();
            return true;
        }

        return false;
    }

    /**
     * Try get Promo
     */
    public tryGetPromo(code: string | number) {
        const str = code.toString();
        const num = Number(code);
        return {
            ACTION: { cash: (1 + str.length / 1.5) | 0, storeElement: str.length % 3 },
        };
    }

    public maybeMeanCode(str: string) {
		return /\w-\w(-\w)?/i.test(str);
	}
}
