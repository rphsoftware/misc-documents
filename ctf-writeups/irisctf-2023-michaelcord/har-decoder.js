const fs = require('fs');
const zlib = require('zlib');
const i = zlib.createInflate({
    chunkSize: 65536,
    flush: zlib.Z_SYNC_FLUSH
});
let recvBuffer = "";
let recvHdr = "";
let recvPromise = () => {};

i.on('data', (c) => {
    recvBuffer += c.toString();
    try {
        JSON.parse(recvBuffer);
        lg(`${recvHdr} ${recvBuffer}`);
        recvPromise();
    } catch(e){};
})
let log = "";

function lg(e) {
    log += e + "\n";
}
let har = JSON.parse(fs.readFileSync('input.har', 'utf-8'));
(async function run() {

let idx = 0;

let ridx = 0;
for (let a of har.log.entries) {
    if (a._resourceType === 'websocket') {
        console.log(a._resourceType);
        log = "";
        idx = 0;
        for (let m of a._webSocketMessages) {
            idx++;
            if (m.type == 'receive') {
                let data = m.data;
                if (m.opcode === 2) {
                    data = Buffer.from(data, 'base64');
                    recvHdr = `[${idx.toString().padStart(8, " ")}] RECV: `;
                    recvBuffer = "";
                    i.write(data);
                    await new Promise(resolve => { recvPromise = resolve });
                } else {
                    lg(`[${idx.toString().padStart(8, " ")}] RECV: ${m.data}`);
                }
            } else {
                lg(`[${idx.toString().padStart(8, " ")}] SEND: ${m.data}`);
            }
        }
        console.log(ridx);
        fs.writeFileSync(`input_${ridx}.txt`, log);
        ridx += 1;
    }
}

})();
