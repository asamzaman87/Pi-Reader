import { CHUNK_TO_PAUSE_ON, HELPER_PROMPT, LISTENERS, PI_START_URL, PI_VOICE_STREAM_URL, PROMPT_INPUT_SELECTOR, TOAST_STYLE_CONFIG, SUBMIT_BUTTON_SELECTOR, TOAST_STYLE_CONFIG_INFO, HELPER_PROMPT_2, PI_CHAT_URL } from "@/lib/constants";
import { Chunk, delay, detectErrorPopup, detectPopup, normalizeAlphaNumeric, setNativeValue, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

interface ExtractedText {
    rawText: string;
    html: string;
  }

interface ChatEvent { event: string; data: any }
type ChatResult =
    | { type: "stream"; events: ChatEvent[] }
    | { type: "error";  events: ChatEvent[] }
  
const useAudioUrl = (isDownload: boolean, isPlaying?: boolean, currentIndex?: number) => {
    const { toast } = useToast();
    const [audioUrls, setAudioUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isBackPressed, setIsBackPressed] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [currentChunkBeingPromptedIndex, setCurrentChunkBeingPromptedIndex] = useState<number>(0);
    const [is9ThChunk, setIs9thChunk] = useState<boolean>(false);
    const [isPromptingPaused, setIsPromptingPaused] = useState<boolean>(false);
    const [wasPromptStopped, setWasPromptStopped] = useState<"LOADING" | "PAUSED" | "INIT">("INIT");
    const { pdfToText, docxToText, textPlainToText } = useFileReader();
    const [progress, setProgress] = useState<number>(0);
    const [downloadPreviewText, setDownloadPreviewText] = useState<string>();
    // const { setVoices, updateVoiceList} = useVoice();
    const { blobs, isFetching, completedStreams, currentCompletedStream, reset: resetStreamListener, voices, isVoiceLoading, setVoices, updateVoiceList } = useStreamListener(setIsLoading);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const isLoopActive = useRef(true);
    let activeSendObserver: MutationObserver | null = null;
    const changePrompt = useRef(false);
    const retryCounts = useRef<Record<number, number>>({});
    const MAX_RETRY = 3;
    
    
    useEffect(()=> {
        if (isBackPressed) {
            isLoopActive.current = false; // Stop the loop by setting ref to false
        }
    }, [isBackPressed]);

    useMemo(() => {
        if (blobs.length === 0) {
            setProgress(0);
            setDownloadPreviewText(undefined);
            return;
        }
        if (currentCompletedStream) {
            const text = chunks[+currentCompletedStream?.chunkNumber]?.text ?? "";
            setDownloadPreviewText(t => (t ?? "") + `${text.replaceAll("\n", " ") ?? ""}`);
        }
        setProgress(((blobs.length ?? 0) / (chunks.length ?? 0)) * 100);
    }, [chunks, blobs, currentCompletedStream]);

    const stopPrompt = async () => {
        //console.log("STOP_PROMPT");
        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
        if (stopButton) {
            stopButton.click();
        }
    };
    const startConversation = async (): Promise<string | null> => {
        try {
            if (conversationId) return conversationId;
            const response = await fetch(PI_START_URL, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({}),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Origin': 'https://pi.ai',
                    'Referer': 'https://pi.ai/discover',
                    'X-API-Version': '3',
                }
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (data.voices && data.voices.length) updateVoiceList(data.voices);
            return data?.mainConversation?.sid as string;
        } catch (error) {
            console.error('Error in startConversation:', error);
            return null;
        }
    };


    // const updateVoiceList =(apiVoices:any)=> {
    //     const voices = apiVoices.map((v:any) => {
    //         const voiceNumber = v.tag.match(/\d+/)?.[0] || "";
    //         return {
    //           voice: v.displayName,
    //           name: `voice${voiceNumber}`,
    //           bloop_color: '',
    //           description: `Voice ${voiceNumber}`,
    //           preview_url: `https://pi.ai/public/media/voice-previews/voice-${voiceNumber}.mp3`,
    //         };
    //     });

    //     if (voices.length > 0) {
    //         console.log('Voices Updated')
    //         setVoices({
    //             voices: voices,
    //             selected: voices[0].name
    //         })
    //     }
    //     console.log('API Generated Voices: ', voices);
    // }
    useEffect(() => {
        if (!conversationId) {
            startConversation().then((sid) => {
                if (sid) setConversationId(sid);
            });
        }
    },[])

    const handleRateLimitExceeded = useCallback((e: Event) => {
        const { detail } = e as Event & { detail: string };
        toast({ description: detail, style: TOAST_STYLE_CONFIG });
    }, [toast]);

    useEffect(() => {
        window.addEventListener("GENERAL_RATE_LIMIT", handleRateLimitExceeded);
        return () => {
            window.removeEventListener("GENERAL_RATE_LIMIT", handleRateLimitExceeded);
        };
    }, [handleRateLimitExceeded]);

    // wait until injected.js fires back the parsed SSE events
    const waitForChatStream = (): Promise<{ event: string; data: any }[]> =>
        new Promise(resolve => {
        const handler = (e: CustomEvent) => {
            window.removeEventListener("PI_CHAT_STREAM", handler as any);
            resolve(e.detail);
        };
        window.addEventListener("PI_CHAT_STREAM", handler as any);
    });

    const waitForChatError = (): Promise<{ event: string; data: any }[]> =>
        new Promise(resolve => {
        const handler = (e: CustomEvent) => {
            window.removeEventListener("GENERAL_ERROR", handler as any);
            resolve(e.detail);
        };
        window.addEventListener("GENERAL_ERROR", handler as any);
    });

    const buildPrompt = (text: string): string => {
        // pick helper prompt and reset changePrompt if needed
        let hp = HELPER_PROMPT;
        if (changePrompt.current) {
            hp = HELPER_PROMPT_2;
            changePrompt.current = false;
        }
        // sanitize whitespace exactly like injectPrompt
        const sanitized = text.replace(/\r?\n+/g, ' ');
        return `${hp}\n${sanitized}`;
    };

    async function fetchChatEvents(
        promptText: string,
        sid: string,
        target: string
    ) {
        const fail = (msg: string) => {
            throw new Error(msg)
        }

        const res = await fetch(PI_CHAT_URL, {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" },
            body:        JSON.stringify({ conversation: sid, text: promptText }),
        })
        if (!res.ok) fail("HTTP " + res.status)

        const reader  = res.body!.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer    = ""
        const events: { event: string; data: any }[] = []
        let actualText = ""

        let inactivity: ReturnType<typeof setTimeout> | undefined;
        // const resetTimer = () => {
        //     clearTimeout(inactivity)
        //     inactivity = setTimeout(() => fail("no-stream activity"), timeoutMs)
        // }
        // resetTimer()

        while (true) {
            const { done, value } = await reader.read().catch(e => fail(e.message))
            if (done) break
            // resetTimer()
            buffer += decoder.decode(value!, { stream: true })

            const parts = buffer.split("\n\n")
            for (let i = 0; i < parts.length - 1; i++) {
            let ev: string | null = null, dataRaw = ""
            for (const line of parts[i].split("\n")) {
                if (line.startsWith("event:")) ev      = line.slice(6).trim()
                if (line.startsWith("data:"))  dataRaw += line.slice(5).trim()
            }
            if (ev && dataRaw) {
                try {
                const parsed = JSON.parse(dataRaw)
                events.push({ event: ev, data: parsed })

                if (ev === "partial" && parsed.text) {
                    actualText += parsed.text
                    const normA = normalizeAlphaNumeric(actualText)
                    const normT = normalizeAlphaNumeric(target)
                    // mid‐stream: only fail if actual outgrows target by >5
                    if (normA.length > normT.length + 5) {
                        fail("mismatch mid‐stream")
                    }
                }
                } catch { /* no‐op */ }
            }
            }

            buffer = parts[parts.length - 1]
        }

        // final absolute‐difference check
        const normA = normalizeAlphaNumeric(actualText)
        const normT = normalizeAlphaNumeric(target)
        if (Math.abs(normA.length - normT.length) > 5) {
            fail("final mismatch")
        }

        return events
    }

    const getCompleteTextChunks = async (arr: any[], voicelist?: any) => {
       const selectedVoiceObject = voicelist.voices.find((v: { voice: string }) => v.voice === voicelist.selected);
       let sid: string | null = conversationId;
          
       if (!conversationId) {
           sid = await startConversation();
           setConversationId(sid);
       }

       if (!sid) { return; }
      
       if (arr && arr.length > 0) {
           const pending: Record<number, string> = {};
           let nextToAppend = 0;
           let events: ChatEvent[];
           let type: ChatResult["type"];
           const tryDrain = () => {
               // If blobUrl for nextToAppend is ready, append it, then loop
               if (!isLoopActive.current) return;
               setAudioUrls(prev => {
                   const newArr = [...prev];
                   while (pending[nextToAppend] !== undefined) {
                       newArr.push(pending[nextToAppend]);
                       delete pending[nextToAppend];
                       nextToAppend++;
                   }
                   return newArr;
               });
           };


           for (let i = 0; i < arr.length && isLoopActive.current; i++) {
                const el = arr[i];
                const prompt = buildPrompt(el.text);
                // 1) Start a 15 s timer that will fire a toast if the call is still pending
                const longCallTimer = setTimeout(() => {
                    toast({
                        description: "Pi Reader is taking longer than usual...you may want to refresh your page and open the extension again if you are getting issues.",
                        style: TOAST_STYLE_CONFIG_INFO
                    });
                }, 15_000);
                if (detectErrorPopup() || !document.querySelector(SUBMIT_BUTTON_SELECTOR)) {
                    try {
                        events = await fetchChatEvents(prompt, sid!, el.text);
                    } catch (err: any) {
                        if ((retryCounts.current[i] ?? 0) >= MAX_RETRY) {
                            return toast({
                                description: "Pi Reader seems to be experiencing issues getting the next audio chunk, please refresh the page and try again.",    
                                style: TOAST_STYLE_CONFIG
                            })
                        }
                        sid = await startConversation();
                        // timeout or mismatch or HTTP error → retry
                        console.warn("chat fetch failed for chunk, retrying:", err.message);
                        if (err.message.includes("429")) {
                            toast({
                                description:
                                    "You may have reached pi.ai's rate limits, trying again...",
                                style: TOAST_STYLE_CONFIG_INFO
                            });
                            await delay(5000);
                        } else {
                            toast({
                                description:
                                    "Pi Reader is taking a bit long to get the next audio chunk… retrying",
                                style: TOAST_STYLE_CONFIG_INFO
                            });
                        }
                        retryCounts.current[i] = (retryCounts.current[i] ?? 0) + 1;
                        changePrompt.current = true;
                        i--;
                        continue;
                    } finally {
                        clearTimeout(longCallTimer);
                    }
                } else {
                    // 1) inject the prompt
                    injectPrompt(el.text);

                    // 2) race between a successful stream or an error event
                    ;({ type, events } = await Promise.race<ChatResult>([
                        waitForChatStream().then((ev) => ({ type: "stream", events: ev })),
                        waitForChatError().then((ev) => ({ type: "error",  events: ev })),
                    ]));

                    clearTimeout(longCallTimer);

                    if (type === 'error') {
                        if ((retryCounts.current[i] ?? 0) >= MAX_RETRY) {
                            return toast({
                                description: "Pi Reader seems to be experiencing issues getting the next audio chunk, please refresh the page and try again.",    
                                style: TOAST_STYLE_CONFIG
                            })
                        }
                        console.warn('Chat error, retrying chunk:', i);
                        sid = await startConversation();
                        await new Promise(res => setTimeout(res, 3000));
                        toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG_INFO });
                        retryCounts.current[i] = (retryCounts.current[i] ?? 0) + 1;
                        i--;              // rewind so we retry this same chunk
                        changePrompt.current = true;
                        continue;
                    }
                }

                // 3) build your voice-note URL
                const msgEvent = events.find(ev => ev.event === "message");
                const audioUrl = msgEvent
                    ? `${PI_VOICE_STREAM_URL}?mode=eager&voice=${selectedVoiceObject?.name}&messageSid=${msgEvent.data.sid}`
                    : null;


                if (!audioUrl) {
                    console.warn('No audio URL for chunk, retrying:', el.text);
                    sid = await startConversation();
                    await new Promise(res => setTimeout(res, 1000));
                    toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG_INFO });
                    i--;               // rewind so we retry this chunk
                    continue;
                }

                (async (chunkIndex: number) => {
                    const maxAttempts = 4;
                    for (let attempt = 0; attempt < maxAttempts && isLoopActive.current; attempt++) {
                        try {
                            const resp = await fetch(audioUrl, { credentials: 'include' });
                            if (!resp.ok) throw new Error(`status ${resp.status}`);
                            const blob = await resp.blob();
                            pending[chunkIndex] = URL.createObjectURL(blob);
                            tryDrain();
                            return;
                        } catch (err) {
                            console.warn(`audio fetch error for chunk ${chunkIndex}, attempt ${attempt}`, err);
                            await new Promise(r => setTimeout(r, 1000));
                            toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG_INFO });
                        }
                    }
                    console.warn(`Failed to fetch audio for chunk ${chunkIndex} after ${maxAttempts} attempts`);
                })(i);

                if (detectErrorPopup()) {
                    await delay(1500);
                }
           }
       }
   };


    const sendPrompt = () => {
        if (!isPlaying && audioUrls.length < chunks.length) {
            setIsLoading(true);
        } else {
            setIsLoading(false)
        }    
    
        const sendButton = document.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;
        if (!sendButton) {
            toast({
                description: `Pi Reader is having trouble sending your chunks in for processing...`,
                style: TOAST_STYLE_CONFIG
            })
            return;
        } 

        if (sendButton && !sendButton.disabled) {
            sendButton.click();
            return;
        }
    
        // Prevent multiple observers
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const btn = document.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;
            if (btn && !btn.disabled) {
                btn.click();
                obs.disconnect();
                activeSendObserver = null;
                clearTimeout(timeout);
            }
        });

        observer.observe(sendButton, {
            attributes: true,
            attributeFilter: ['disabled']
        });
        activeSendObserver = observer;
    
        const timeout = setTimeout(() => {
            observer.disconnect();
            activeSendObserver = null;
            console.error("[sendPrompt] Send button not found after 120 seconds.");
            toast({
                description: `Pi Reader is having trouble, please click on the back button and try again`,
                style: TOAST_STYLE_CONFIG
            })
        }, 120_000);
    };

    
    const injectPrompt = useCallback((text: string) => {
        const textarea = document.querySelector(PROMPT_INPUT_SELECTOR) as HTMLTextAreaElement;
        let hp = HELPER_PROMPT;
        if (changePrompt.current) {
            hp = HELPER_PROMPT_2;
            changePrompt.current = false;
        }
        if (textarea) {
            const sanitized = text.replace(/\r?\n+/g, ' ');
            const raw = `${hp}\n${sanitized}`;
            // ── Use the native setter so React sees the change ──
            if (document.activeElement !== textarea) {
                textarea.focus();
            }
            setNativeValue(textarea, raw);

            // ── Let React’s onChange/onInput fire ──
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));

            requestAnimationFrame(() => {
                // DEBUG: confirm React saw it
                // console.log('[injectPrompt] textarea.value=', textarea.value);
                // const btn = document.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;
                // console.log('[injectPrompt] send button disabled=', btn?.disabled);

                // Now trigger sendPrompt
                sendPrompt();
            });
        } else {
            const errorMessage = `Pi Reader is having trouble, please refresh your page and try again`;
            window.dispatchEvent(new CustomEvent(LISTENERS.ERROR, { detail: { message: errorMessage } }));
            toast({
                description: errorMessage,
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);


    const splitAndSendPrompt = async (text: string, voicelist?: any, isDocxType?: boolean, html?: any) => {
        // console.log("SPLIT_AND_SEND_PROMPT");
        const displayText = isDocxType ? (html?.trim() || text) : text;
        setText(displayText);
        
        const textWithoutTags = text.replace(/<img[^>]*src\s*=\s*["']\s*data:image\/[a-zA-Z]+;base64,[^"']*["'][^>]*>/gi, ''); //removes image tag if it exist in the prompt
        const chunks: Chunk[] = await splitIntoChunksV2(textWithoutTags);
        setChunks(chunks);
        getCompleteTextChunks(chunks, voicelist);

        if (chunks.length > 0) {
            setCurrentChunkBeingPromptedIndex(currentChunkBeingPromptedIndex);
            setChunks(chunks);
            // injectPrompt(chunks[0].text, chunks[0].id);
        }

        return
    };

    const extractText = async (file: File): Promise<ExtractedText | undefined> => {
        switch (file.type) {
          case "application/pdf": {
            const text = await pdfToText(file); // returns string
            return {
              rawText: text,
              html: `<p>${text.replace(/\n/g, "</p><p>")}</p>`,
            };
          }
      
          case "application/msword":
          case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
            return await docxToText(file); // returns { rawText, html }
          }
      
          case "text/plain":
          case "text/rtf": {
            const text = await textPlainToText(file); // returns string
            return {
              rawText: text,
              html: `<p>${text.replace(/\n/g, "</p><p>")}</p>`,
            };
          }
      
          default:
            toast({
              description: chrome.i18n.getMessage("unsupported_file_type"),
              style: TOAST_STYLE_CONFIG,
            });
            return;
        }
      };

    const reset = () => {
        setAudioUrls([]);
        setCurrentChunkBeingPromptedIndex(0);
        setChunks([]);
        stopPrompt()
        setText("");
        setIsLoading(false);
        resetStreamListener();
        isLoopActive.current = false;
        if (isDownload) {
            setProgress(0);
            setDownloadPreviewText(undefined);
        }
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }
        changePrompt.current = false;
        retryCounts.current = {};
    }

    useMemo(() => {
        if (!isDownload) {
            const chunkNumber = currentCompletedStream?.chunkNumber;
            if (chunkNumber && +chunkNumber > 0 && +chunkNumber < chunks.length - 1 && (((+chunkNumber + 1) % CHUNK_TO_PAUSE_ON) === 0)) {
                setIsPromptingPaused(true);
                setWasPromptStopped("PAUSED");
            }
        }
    }, [currentCompletedStream, chunks]);

    const reStartChunkProcess = () => {
        const nextChunk = chunks[currentChunkBeingPromptedIndex + 1];
        if (nextChunk && currentCompletedStream) {
            //console.log("RESTART WITH NEXT_CHUNK");
            setIsPromptingPaused(false);
            setCurrentChunkBeingPromptedIndex(+currentCompletedStream.chunkNumber + 1);
            injectPrompt(nextChunk.text);
        }
    };

    const downloadCombinedFile = useCallback(async (fileName: string) => {
        try {
            const sanitisedFileName = fileName.split('.').slice(0, -1).join('.');
            // The Blob constructor automatically concatenates the provided blob parts.
            const combinedBlob = new Blob(blobs, {
                type: blobs[0]?.type || "audio/aac",
            });

            // Create an object URL for the combined blob
            const combinedUrl = URL.createObjectURL(combinedBlob);

            // Create a temporary download link and trigger a click to start download
            const downloadLink = document.createElement("a");
            downloadLink.href = combinedUrl;
            downloadLink.download = `${sanitisedFileName}.mp3`;
            document.body.appendChild(downloadLink);
            downloadLink.click();

            // Clean up: remove the link and revoke the object URL
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(combinedUrl);
        } catch (error) {
            console.error("Error downloading combined file:", error);
        }
    }, [blobs])

    useEffect(() => {
        if (completedStreams.length > 0) {
            if (!isDownload) setAudioUrls(completedStreams);
            if (
                currentCompletedStream?.chunkNumber &&
                +currentCompletedStream.chunkNumber !== chunks.length - 1 && !isPromptingPaused
            ) {
                const nextChunk = chunks[+currentCompletedStream.chunkNumber + 1];
                if (nextChunk) {
                    //console.log("NEXT_CHUNK");
                    setCurrentChunkBeingPromptedIndex(
                        +currentCompletedStream.chunkNumber + 1
                    );
                    injectPrompt(nextChunk.text);
                }
            }
        }


    }, [chunks, completedStreams, currentChunkBeingPromptedIndex, currentCompletedStream, injectPrompt, voices.selected, isPromptingPaused])

    return { downloadPreviewText, downloadCombinedFile, progress, setProgress, blobs, isFetching, wasPromptStopped, setWasPromptStopped, chunks, voices, setVoices, isVoiceLoading, text, audioUrls, setAudioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNumber && +currentCompletedStream?.chunkNumber === chunks.length - 1, isLoading, setIsLoading, reset, is9ThChunk, reStartChunkProcess, setIs9thChunk, isPromptingPaused, setIsPromptingPaused, isBackPressed, setIsBackPressed, isLoopActive }

};

export default useAudioUrl;
