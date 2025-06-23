import { CHUNK_TO_PAUSE_ON, HELPER_PROMPT, LISTENERS, PI_START_URL, PI_VOICE_STREAM_URL, PROMPT_INPUT_SELECTOR, TOAST_STYLE_CONFIG, SUBMIT_BUTTON_SELECTOR } from "@/lib/constants";
import { Chunk, setNativeValue, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

interface ExtractedText {
    rawText: string;
    html: string;
  }
  
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


    // const sendPrompt = async () => {

    //     // fetc
    //     //console.log("SEND_PROMPT");
    //     // setIsLoading(true);
    //     // const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
    //     // // toast({ description:"It seems that Pi.ai might be either disPlaying an error, generating a prompt, or you've reached your hourly limit. Please check on the Pi.ai website for the exact error.", style: TOAST_STYLE_CONFIG });
    //     // if (!sendButton) return
    //     // sendButton.click();

    //     const textarea = document.querySelector('textarea');
    //     const button = textarea?.closest('div.relative')?.querySelector('button');
    //     // console.log('Button: ', button);

    //     const audio = document.querySelector('main audio');
    //     const AudioButton = audio?.closest('main')?.querySelector('button');
    //     var test = document.querySelector('.relative.flex.items-center.justify-end.self-end.overflow-hidden.p-2.bg-neutral-200');

    //     if (AudioButton) {
    //         // AudioButton.click(); // Unmutte the voice
    //     }
    //     if (button) {
    //         // button.click(); //  triggers the click
    //     }
    //     // Step 1: Select the audio element
    //     const audio1 = document.querySelector('audio');

    //     // Step 2: Go to the div after audio
    //     const parentDiv = audio1?.nextElementSibling;

    //     // Step 3: Go to the first child inside that div
    //     const innerWrapper = parentDiv?.firstElementChild;

    //     // Step 4: Get the second div inside the innerWrapper
    //     const targetDiv = innerWrapper?.children[1]; // Index 1 = second div

    //     // Step 5: Count buttons inside the targetDiv
    //     if (targetDiv) {
    //         const buttons = targetDiv.querySelectorAll('button');
    //         // console.log('Number of buttons:', buttons.length);

    //         if (buttons.length === 1) {
    //             // buttons[0]?.click();
    //         }

    //     } else {
    //         console.log('Target div not found');
    //     }

    //     // const buttons = test ? test.querySelectorAll('button') : [];
    //     // console.log('Buttons: ',  buttons.length);


    // };

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
    
     const getCompleteTextChunks = async (arr: any[], voicelist?: any) => {
        const allVoices: string[] = [];
        const selectedVoiceObject = voicelist.voices.find((v: { voice: string }) => v.voice === voicelist.selected);
        let sid: string | null = conversationId;
            
        if (!conversationId) {
            sid = await startConversation();
            setConversationId(sid);
        }
        if (arr && arr.length > 0) {
            for (let i = 0; i < arr.length && isLoopActive.current; i++) {
                const el = arr[i];

                // 1) inject the prompt
                injectPrompt(el.text);

                // 2) race between a successful stream or an error event
                const { type, events } = await Promise.race([
                    waitForChatStream().then(ev => ({ type: 'stream' as const, events: ev })),
                    waitForChatError().then(ev => ({ type: 'error' as const, events: ev }))
                ]);

                if (type === 'error') {
                    console.warn('Chat error, retrying chunk:', el.text);
                    await new Promise(res => setTimeout(res, 3000));
                    toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG });
                    i--;              // rewind so we retry this same chunk
                    continue;
                }

                // 3) build your voice-note URL
                const msgEvent = events.find(ev => ev.event === "message");
                const audioUrl = msgEvent
                    ? `${PI_VOICE_STREAM_URL}?mode=eager&voice=${selectedVoiceObject?.name}&messageSid=${msgEvent.data.sid}`
                    : null;

                if (!audioUrl) {
                    console.warn('No audio URL for chunk, retrying:', el.text);
                    await new Promise(res => setTimeout(res, 3000));
                    toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG });
                    i--;               // rewind so we retry this chunk
                    continue;
                }

                // retry up to 4 times with 1s delay
                const maxAttempts = 4;
                let resp: Response | null = null;
                let attempt = 0;

                while (attempt < maxAttempts && isLoopActive.current) {
                    resp = await fetch(audioUrl, { credentials: 'include' });
                    if (resp.ok) break;
                    attempt++;
                    await new Promise(res => setTimeout(res, 3000));
                }

                if (!resp || !resp.ok) {
                    console.warn(`Failed to fetch audio after ${maxAttempts} attempts for chunk, retrying:`, el.text);
                    toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG });
                    i--;               // rewind so we retry this chunk
                    continue;
                }

                let blob: Blob;
                try {
                    blob = await resp.blob();
                } catch {
                    console.warn(`Error blobbing audio, retrying...`);
                    toast({ description: `Pi Reader is taking a bit long to get the next audio chunk, please wait a few seconds...`, style: TOAST_STYLE_CONFIG });
                    i--;               // rewind so we retry this chunk
                    continue;
                }
                
                const blobUrl = URL.createObjectURL(blob);
                if (isLoopActive.current) {
                    setAudioUrls(prev => [...prev, blobUrl]);
                }
            }
            // You can do something further with `allVoices` here
        }
    };


    const sendPrompt = () => {
        if (!isPlaying && audioUrls.length < chunks.length) {
            setIsLoading(true);
        } else {
            setIsLoading(false)
        }    
    
        const sendButton = document.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;
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
    
        observer.observe(document.body, { childList: true, subtree: true });
        activeSendObserver = observer;
    
        const timeout = setTimeout(() => {
            observer.disconnect();
            activeSendObserver = null;
            console.error("[sendPrompt] Send button not found after 35 seconds.");
            toast({
                description: `Pi Reader is having trouble, please click on the back button and try again`,
                style: TOAST_STYLE_CONFIG
            })
        }, 35000);
    };

    
    const injectPrompt = useCallback((text: string) => {
        const textarea = document.querySelector(PROMPT_INPUT_SELECTOR) as HTMLTextAreaElement;

        if (textarea) {
            const raw = `${HELPER_PROMPT}\n\n${text}`;
            // ── Use the native setter so React sees the change ──
            if (document.activeElement !== textarea) {
                textarea.focus();
            }
            setNativeValue(textarea, raw);

            // ── Let React’s onChange/onInput fire ──
            textarea.dispatchEvent(new Event("input",  { bubbles: true }));
            textarea.dispatchEvent(new Event("change", { bubbles: true }));

            sendPrompt();
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

}

export default useAudioUrl;
