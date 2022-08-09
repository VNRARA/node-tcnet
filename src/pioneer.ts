import { TCNetClient, TCNetPacket } from "./";
import { TCNetConfiguration } from "./tcnet";
import {
    TCNetStatusPacket,
    TCNetDataPacketType,
    TCNetDataPacketMetadata,
    TCNetDataPacketBeatGridData,
    TCNetLayerStatus,
    TCNetDataPacketMetrics,
    TCNetLayerSyncMaster,
    TCNetDataPacketMixerData,
} from "./network";
import EventEmitter = require("events");
import { assert } from "console";
import Color = require("color");



/**
 * High level implementation of TCNet for PioneerDJ equipment
 *
 * Currently only supports status changes and querying of track IDs
 */
export class PioneerDJTCClient extends EventEmitter {
    private tcnet: TCNetClient;
    private _state: PioneerDJState = new PioneerDJState();

    /**
     *
     * @param config configuration for TCNet access
     */
    constructor(config?: TCNetConfiguration) {
        super();

        if (!config) config = new TCNetConfiguration();

        this.tcnet = new TCNetClient(config);
    }

    /**
     * Connect to the TCNet network
     */
    async connect(): Promise<void> {
        this.tcnet.on("broadcast", this.receiveBroadcast.bind(this));
        await this.tcnet.connect();
    }

    /**
     * Disconnects from TCNet network
     */
    disconnect(): void {
        this.removeAllListeners();
        this.tcnet.disconnect();

    }

    /**
     * Receive a broadcast packet from the underlying TCNet implementation
     *
     * @param packet received broadcast packet
     */
    private receiveBroadcast(packet: TCNetPacket): void {
        if (packet instanceof TCNetStatusPacket) {
            // First update the current state - handlers can therefore savely query the state.
            const changedTracks = this._state.updateTrackIDs(packet.trackID);
            const changedStatus = this._state.updateStatus(packet.layerStatus);

            changedTracks.forEach((el) => {
                this.emit("changedtrack", el);
            });
            changedStatus.forEach((el) => {
                this.emit("changedstatus", el);
            });

            // Emit general status change when we see changes in track or status
            if (changedTracks.length > 0 || changedStatus.length > 0) {
                this.emit("statuschange");
            }
        }
    }

    /**
     * Access to current Pioneer DJ State
     */
    state(): PioneerDJState {
        return this._state;
    }

    /**
     * Access to underlying client
     */
    client(): TCNetClient {
        return this.tcnet;
    }

    /**
     * Request track info of a specific layer
     * @param layer layer to query
     * @returns track info of the layer
     */
    async trackInfo(layer: LayerIndex): Promise<TrackInfo> {
        const response = <TCNetDataPacketMetadata>(
            await this.client().requestData(TCNetDataPacketType.MetaData, layer)
        );
        return {
            ...response,
        };
    }

    /**
     * Request metrics of a specific layer
     * @param layer layer to query
     * @returns metrics of the layer
     */
    async layerMetrics(layer: LayerIndex): Promise<LayerMetrics> {
        const response = <TCNetDataPacketMetrics>(
            await this.client().requestData(TCNetDataPacketType.MetricsData, layer)
        );
        return {
            ...response,
        };
    }

    /**
     * Request metrics of a specific layer
     * @param layer layer to query
     * @returns metrics of the layer
     */
    async mixerData(): Promise<MixerData> {
        const response = <TCNetDataPacketMixerData>(
            await this.client().requestData(TCNetDataPacketType.MixerData, 0)
        );
        return {
            ...response,
        };
    }


    /**
 * Request beatgrid of a specific layer
 * @param layer layer to query
 * @returns metrics of the layer
 */
    async beatGridData(layer: LayerIndex): Promise<BeatGridData> {
        const response = <TCNetDataPacketBeatGridData>(
            await this.client().requestData(TCNetDataPacketType.BeatGridData, layer)
        );
        return {
            ...response,
        };
    }

}

/**
 * Enumeration of layers
 */
export enum LayerIndex {
    Layer1 = 1,
    Layer2 = 2,
    Layer3 = 3,
    Layer4 = 4,
    LayerA = 5,
    LayerB = 6,
    LayerM = 7,
    LayerC = 8,
}

/**
 * Util for LayerIndex
 */
export class LayerIndexUtil {
    /**
     * convert layer number (1-4) to layer index
     * @param layer Layer Number
     */
    public static layerToIdx(layer: number): LayerIndex {
        assert(1 <= layer && layer <= 4, "Layer Number must be in the range of 1-4");
        return layer;
    }
}

/**
 * Tracking the state of the Pioneer DJ equipments
 */
class PioneerDJState {
    private _trackID: number[] = new Array(8).fill(-1);
    private _status: TCNetLayerStatus[] = new Array(8).fill(-1);

    /**
     * Get track ID of layer
     * @param idx layer
     * @returns track ID
     */
    trackID(idx: LayerIndex): number {
        return this._trackID[idx - 1];
    }

    /**
     * Get status of layer
     * @param idx layer
     * @returns status
     */
    status(idx: LayerIndex): TCNetLayerStatus {
        return this._status[idx - 1];
    }

    /**
     * Updates Track IDs
     * @param trackIDs track IDs received from gear
     * @returns Changed layers
     */
    updateTrackIDs(trackIDs: number[]): LayerIndex[] {
        return this.update(this._trackID, trackIDs);
    }

    /**
     * Updates status
     * @param status statuses received from gear
     * @returns Changed layers
     */
    updateStatus(status: TCNetLayerStatus[]): LayerIndex[] {
        return this.update(this._status, status);
    }

    /**
     * Internal method for easy updating of fields
     * @param field field / array in this class
     * @param source Source date to update from
     * @returns Changed layers
     */
    private update(field: any[], source: any[]): LayerIndex[] {
        assert(source.length == 8, "there must be data for exactly 8 layers");
        const changedLayers: LayerIndex[] = [];

        for (let i = 0; i < source.length; i++) {
            if (field[i] !== source[i]) {
                field[i] = source[i];
                changedLayers.push(i + 1);
            }
        }

        return changedLayers;
    }
}

/**
 * Track Info type
 */
export type TrackInfo = {
    trackID: number;
    trackArtist: string;
    trackTitle: string;
    trackKey: string;
};

export type LayerMetrics = {
    state: TCNetLayerStatus;
    syncMaster: TCNetLayerSyncMaster;
    beatMarker: number;
    trackLength: number;
    currentPosition: number;
    speed: number;
    beatNumber: number;
    bpm: number;
    pitchBend: number;
    trackID: number;
};

export type BeatGridData = {
    dataSize: number;
    totalPacket: number;
    packetNo: number;
    dataClusterSize: number;
    beatNumber: number;
    beatType: number;
    beatTypeTimestamp: number;
    packetNumber: number;
};

export type CueData = {
    loopIn: number;
    loopOut: number;
    cue1Type: number;
    cue1InTime: number;
    cue1OutTime: number;
    cue1Color: Color;
    cue2Type: number;
    cue2InTime: number;
    cue2OutTime: number;
    cue2Color: Color;
    cue3Type: number;
    cue3InTime: number;
    cue3OutTime: number;
    cue3Color: Color;
    cue4Type: number;
    cue4InTime: number;
    cue4OutTime: number;
    cue4Color: Color;
    cue5Type: number;
    cue5InTime: number;
    cue5OutTime: number;
    cue5Color: Color;
    cue6Type: number;
    cue6InTime: number;
    cue6OutTime: number;
    cue6Color: Color;
    cue7Type: number;
    cue7InTime: number;
    cue7OutTime: number;
    cue7Color: Color;
    cue8Type: number;
    cue8InTime: number;
    cue8OutTime: number;
    cue8Color: Color;
    cue9Type: number;
    cue9InTime: number;
    cue9OutTime: number;
    cue9Color: Color;
    cue10Type: number;
    cue10InTime: number;
    cue10OutTime: number;
    cue10Color: Color;
    cue11Type: number;
    cue11InTime: number;
    cue11OutTime: number;
    cue11Color: Color;
    cue12Type: number;
    cue12InTime: number;
    cue12OutTime: number;
    cue12Color: Color;
    cue13Type: number;
    cue13InTime: number;
    cue13OutTime: number;
    cue13Color: Color;
    cue14Type: number;
    cue14InTime: number;
    cue14OutTime: number;
    cue14Color: Color;
    cue15Type: number;
    cue15InTime: number;
    cue15OutTime: number;
    cue15Color: Color;
    cue16Type: number;
    cue16InTime: number;
    cue16OutTime: number;
    cue16Color: Color;
    cue17Type: number;
    cue17InTime: number;
    cue17OutTime: number;
    cue17Color: Color;
    cue18Type: number;
    cue18InTime: number;
    cue18OutTime: number;
    cue18Color: Color;
}

export type MixerData = {

    mixerId: number;
    mixerType: number;
    mixerName: string;
    micEQHi: number;
    micEQLow: number;
    masterAudioLevel: number;
    masterFaderLevel: number;
    linkCueA: number;
    linkCueB: number;
    masterFilter: number;
    masterCueA: number;
    masterCueB: number;
    masterIsolatorOnOff: number;
    masterIsolatorHi: number;
    masterIsolatorMid: number;
    masterIsolatorLow: number;
    filterHPF: number;
    filterLPF: number;
    filterRes: number;
    sendFXEffect: number;
    sendFXExt1: number;
    sendFXExt2: number;
    sendFXMasterMix: number;
    sendFXSizeFeedback: number;
    sendFXTime: number;
    sendFXHPF: number;
    sendFXLevel: number;
    sendReturn3SourceSelect: number;
    sendReturn3Type: number;
    sendReturn3OnOff: number;
    sendReturn3Level: number;
    channelFaderCurve: number;
    crossFaderCurve: number;
    crossFader: number;
    beatFxOnOff: number;
    beatFxLevelDepth: number;
    beatFxChannelSelect: number;
    beatFxSelect: number;
    beatFxFreqHi: number;
    beatFxFreqMid: number;
    beatFxFreqLow: number;
    headphonesPreEq: number;
    headphonesALevel: number;
    headphonesAMix: number;
    headphonesBLevel: number;
    headphonesBMix: number;
    boothLevel: number;
    boothEqHi: number;
    boothEqLow: number;
    channel1SourceSelect: number;
    channel1AudioLevel: number;
    channel1FaderLevel: number;
    channel1TrimLevel: number;
    channel1CompLevel: number;
    channel1EqHiLevel: number;
    channel1EqHiMidLevel: number;
    channel1EqLowMidLevel: number;
    channel1EqLowLevel: number;
    channel1FilterColor: number;
    channel1Send: number;
    channel1CueA: number;
    channel1CueB: number;
    channel1CrossfaderAssign: number;

    channel2SourceSelect: number;
    channel2AudioLevel: number;
    channel2FaderLevel: number;
    channel2TrimLevel: number;
    channel2CompLevel: number;
    channel2EqHiLevel: number;
    channel2EqHiMidLevel: number;
    channel2EqLowMidLevel: number;
    channel2EqLowLevel: number;
    channel2FilterColor: number;
    channel2Send: number;
    channel2CueA: number;
    channel2CueB: number;
    channel2CrossfaderAssign: number;

    channel3SourceSelect: number;
    channel3AudioLevel: number;
    channel3FaderLevel: number;
    channel3TrimLevel: number;
    channel3CompLevel: number;
    channel3EqHiLevel: number;
    channel3EqHiMidLevel: number;
    channel3EqLowMidLevel: number;
    channel3EqLowLevel: number;
    channel3FilterColor: number;
    channel3Send: number;
    channel3CueA: number;
    channel3CueB: number;
    channel3CrossfaderAssign: number;

    channel4SourceSelect: number;
    channel4AudioLevel: number;
    channel4FaderLevel: number;
    channel4TrimLevel: number;
    channel4CompLevel: number;
    channel4EqHiLevel: number;
    channel4EqHiMidLevel: number;
    channel4EqLowMidLevel: number;
    channel4EqLowLevel: number;
    channel4FilterColor: number;
    channel4Send: number;
    channel4CueA: number;
    channel4CueB: number;
    channel4CrossfaderAssign: number;

    channel5SourceSelect: number;
    channel5AudioLevel: number;
    channel5FaderLevel: number;
    channel5TrimLevel: number;
    channel5CompLevel: number;
    channel5EqHiLevel: number;
    channel5EqHiMidLevel: number;
    channel5EqLowMidLevel: number;
    channel5EqLowLevel: number;
    channel5FilterColor: number;
    channel5Send: number;
    channel5CueA: number;
    channel5CueB: number;
    channel5CrossfaderAssign: number;

    channel6SourceSelect: number;
    channel6AudioLevel: number;
    channel6FaderLevel: number;
    channel6TrimLevel: number;
    channel6CompLevel: number;
    channel6EqHiLevel: number;
    channel6EqHiMidLevel: number;
    channel6EqLowMidLevel: number;
    channel6EqLowLevel: number;
    channel6FilterColor: number;
    channel6Send: number;
    channel6CueA: number;
    channel6CueB: number;
    channel6CrossfaderAssign: number;

}