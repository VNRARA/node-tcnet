import * as broadcastAddress from "broadcast-address";
import { networkInterfaces, platform } from "os";
import Color = require("color");

export function interfaceAddress(ifname: string): string {
    const os = platform();

    if (os === "win32") {
        const intf = networkInterfaces()[ifname];
        if (!intf) {
            throw new Error(`Interface ${ifname} does not exist`);
        }

        const address = intf.find((el) => el.family == "IPv4");
        if (!address) {
            throw new Error(`Interface ${ifname} does not have IPv4 address`);
        }

        return address.address;
    } else {
        return broadcastAddress(ifname);
    }
}

export function toColor(buffer: Buffer): Color {
    if (buffer.length != 3) {
        throw new Error("amount of bytes not correct for RGB");
    }
    return Color.rgb(buffer.readUInt8(0), buffer.readUInt8(1), buffer.readUInt8(2));
}
