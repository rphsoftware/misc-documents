# IrisCTF 2023: MichaelCord

![Challenge image](https://i-work-at-the.dutch-east-india.company/𒄡63bc26b9Aa62ULvVfuCy.png)

> I have finally gotten access to the mystical Michaelcord. Unfortunately it seems like they don't fully trust me, maybe there is something I just can't see yet.
>
> I attached a network capture from my discord, maybe you have better luck.

## Stage 1: The challenge file

The challenge comes with one .har file, at around 40 MB in size. The best way to think about har files is as a representation of the DevTools "network" panel. In fact, you can even load them into devtools to view their contents, and export them as captures of the current website. On the technical side of things, they are essentially a very long JSON document with details of each HTTP request sent, contents of responses as well as headers.

## Stage 2: The data of interest

The way Discord works is that a majority of general UI state is sent using the gateway websocket to the client. For example, there is no HTTP endpoint to get your list of servers (Discord internally refers to them as guilds, and I will too from this point onwards) or a guild's member list. All of that is transmitted over the main websocket connection. 

As such, the next step of the challenge is to identify and extract the client-facing websocket traffic. In the challenge har file, that data starts at line 12057 with a request to `wss://gateway.discord.gg/?encoding=json&v=9&compress=zlib-stream`. This URL already tells us a few things to expect, mainly that data will be encoded using JSON and compressed using something called `zlib-stream`. We'll get back to that.

![Screenshot of the HAR file](https://i-work-at-the.dutch-east-india.company/%F0%92%84%A163bc2a3016LSOIB9t5X3.png)


The important part of this request object inside the HAR file is the `_webSocketMessages` field. It contains all the traffic that was sent using this websocket, which is precisely what we need. Each message is also a JSON object, with 3 important fields: `type`, `opcode` and `data`. For this, `time` is irrelevant.

- Plaintext messages are sent with `opcode` set to 1, and the `data` containing their literal representation.
- Binary messages are sent with `opcode` set to 2, and the `data` containing their base64 representation.

For the purpose of this challenge, the only relevant data is incoming to the client, and therefore it's safe to discard data sent from the client back to the server. Additionally, since all data Discord sends back to the client is binary, we can always apply base64 decoding to it.

## Stage 3: Getting at the actual traffic

The important question that someone at Discord likely asked themselves is: "How do we compress a lot of WebSocket traffic?". The answer isn't obvious, and requires a bit of extra work. The simple solution would be to simply compress each packet individually, however with that approach, you have to re-transmit the zlib header with each message, which can potentially be highly wasteful with smaller messages. Instead, Discord decided to use a hacky workaround they call `zlib-stream`. The way zlib works is that typically you'd have chunks with end markers placed with roughly the same intervals between each one. However, if you want to ensure that the client can decode the message immediately, that doens't work.

Instead, Discord uses their compressor with the `Z_SYNC_FLUSH` flag, which is characterized by the fact, that chunks are finalized immediately. The resulting bitstream is technically compliant, however it never has an end of stream marker, only end of block.

Figuring this out, as well as the fact that Discord uses a non-standard Chunk Size (`65536`) instead of the standard `16384` allows us to properly decompress the data.

Not setting either of those values would cause the decompressor to fail, either with an "invalid block" message (the buffer gets full before it can be properly decompressed) or the stream ending without a proper deflate end of stream marker, which also caused errors.

Attached to this repository is an example program that can take a Discord .har file, apply the zlib decompression and export cleartext gateway traffic to a file.

## Stage 4: Where is the flag?

After decoding the file, you can either simply search for the flag pattern, or actually understand the traffic. The flag was hidden as a name of a role not granted to anyone on the "michaelcord" server, which on all up-to-date Discord client applications typically isn't visible to unuthorized users.

## Unintended solutions:

We are aware of 2 alternate solutions to the task that came from the fact that we didn't delete the discord guild invite present in the har file and actually allowed people to join it.

- On pre-react native builds of the Android Discord client, the "change your server nickname" prompt contained a grayed-out list of all server roles, with a checkbox next to the ones you have, instead of just the ones you have.
- Due to recent changes in how Discord handles mentioning roles, simply typing `@iris` in the message box, showed a suggestion containing the role, despite it being marked as non-mentionable.

Both of these unintended solutions would be impossible had we invalidated the invite and closed the guild off prior to publishing the har file.

