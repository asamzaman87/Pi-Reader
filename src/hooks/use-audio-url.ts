import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, HELPER_PROMPT, LISTENERS, PI_API_CONVERSATION_API_DELAY, PI_CHAT_URL, PI_START_URL, PI_VOICE_STREAM_URL, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { Chunk, splitIntoChunksV1, splitIntoChunksV2, splitIntoChunksV3 } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

const useAudioUrl = (isDownload: boolean) => {
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
    //     // // toast({ description:"It seems that ChatGPT might be either displaying an error, generating a prompt, or you've reached your hourly limit. Please check on the ChatGPT website for the exact error.", style: TOAST_STYLE_CONFIG });
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

    const getAudioStream = async (text: any, sid: any, voicelist?: any): Promise<string | null> => {
        let voiceNote: string | null = null;
        const selectedVoiceObject = voicelist.voices.find((v: { voice: string }) => v.voice === voicelist.selected);

        try {

            if (!sid) {
                throw new Error("SID not found");
            }

            var requestBody = {
                conversation: sid,
                text: text
            }
            const response = await fetch(PI_CHAT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            
    
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text")) {
                const raw = await response.text();
                const chunks = raw.split("\n\n");
    
                for (const chunk of chunks) {
                    const lines = chunk.split("\n");
                    let event = null;
                    let data = "";
    
                    for (const line of lines) {
                        if (line.startsWith("event:")) {
                            event = line.replace("event:", "").trim();
                        } else if (line.startsWith("data:")) {
                            data += line.replace("data:", "").trim();
                        }
                    }
    
                    if (event && data) {
                        try {
                            console.log('selectedVoiceObject: ', selectedVoiceObject);
                            const parsedData = JSON.parse(data);
                            if (event === 'message') {
                                voiceNote = `${PI_VOICE_STREAM_URL}?mode=eager&voice=${selectedVoiceObject?.name}&messageSid=${parsedData.sid}`
                            }
                        } catch (e) {
                            console.warn("❗ Failed to parse SSE data:", e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        }
        return voiceNote;
    };
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
     // useRef to track the loop's active state
    
    const getCompleteTextChunks = async (arr: any[], voicelist?: any) => {
        const allVoices: string[] = [];
        let sid: string | null = conversationId;
            
        if (!conversationId) {
            sid = await startConversation();
            setConversationId(sid);
        }
        console.log('Array Of Text : ', arr);
        if (arr && arr.length > 0) {
            for (const el of arr) {
                if (!isLoopActive.current) break;

                let audioUrl = await getAudioStream(`${HELPER_PROMPT} ${el.text}`, sid, voicelist); // 👈 await here
                if (audioUrl) {
                    setAudioUrls(prev => [...prev, audioUrl]); // Push incrementally
                }

                // Wait 3 seconds before next request to avoid rate limiting
                await delay(PI_API_CONVERSATION_API_DELAY);
            }
            // You can do something further with `allVoices` here
        }
    };


    

    const injectPrompt = useCallback((text: string, id: string) => {
        //console.log("INJECT_PROMPT", id);
        const textarea = document.querySelector('textarea');
        // const textarea = document.querySelector('body > main textarea') as HTMLTextAreaElement;
        // console.log('textarea: ', textarea)
        if (textarea) {

            // textarea.value = `${HELPER_PROMPT} ${text}`;
            // getAudioStream(`${HELPER_PROMPT} ${text}`);
            // Create and dispatch events
            // textarea.dispatchEvent(new Event('change', { bubbles: true }));
            // textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a', code: 'KeyA' }));
            // textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a', code: 'KeyA' }));

            // const button = textarea?.closest('div.relative')?.querySelector('button');
            // console.log('Button: ', button);

            // const audio = document.querySelector('main audio');
            // const AudioButton = audio?.closest('main')?.querySelector('button');
            // setTimeout(() => {
                // sendPrompt();
                // if (AudioButton) {
                //     AudioButton.click(); // Unmutte the voice
                // }
                // if (button) {
                //     button.click(); //  triggers the click
                // }
            // }, 200);
        } else {
            const errorMessage = chrome.i18n.getMessage('chatgpt_issue');
            window.dispatchEvent(new CustomEvent(LISTENERS.ERROR, { detail: { message: errorMessage } }));
            toast({
                description: errorMessage,
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);

    const splitAndSendPrompt = async (text: string, voicelist?: any) => {
        // console.log("SPLIT_AND_SEND_PROMPT");
        setText(text);
        const textWithoutTags = text.replace(/<img[^>]*src\s*=\s*["']\s*data:image\/[a-zA-Z]+;base64,[^"']*["'][^>]*>/gi, ''); //removes image tag if it exist in the prompt
        const chunks: Chunk[] = await splitIntoChunksV3(textWithoutTags, CHUNK_SIZE);
        getCompleteTextChunks(chunks, voicelist);

        console.log("Voices: ", voices);
        if (chunks.length > 0) {
            setCurrentChunkBeingPromptedIndex(currentChunkBeingPromptedIndex);
            setChunks(chunks);
            // injectPrompt(chunks[0].text, chunks[0].id);
        }

        return
    };

    const extractText = async (file: File) => {
        //console.log("EXTRACT_TEXT");
        switch (file.type) {
            case "application/pdf": {
                // const text = await pdfToText(file);
                // splitAndSendPrompt(text);
                return await pdfToText(file);
            }
            case "application/msword":
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
                // const text = await docxToText(file);
                // splitAndSendPrompt(text);
                return await docxToText(file);
            }
            case "text/plain":
            case "text/rtf": {
                // const text = await textPlainToText(file);
                // splitAndSendPrompt(text);
                return await textPlainToText(file);
            }
            default:
                toast({ description: chrome.i18n.getMessage('unsupported_file_type'), style: TOAST_STYLE_CONFIG });
                break;
        }
    }

    const reset = () => {
        setAudioUrls([]);
        setCurrentChunkBeingPromptedIndex(0);
        setChunks([]);
        stopPrompt()
        setText("");
        setIsLoading(false);
        resetStreamListener();
        if (isDownload) {
            setProgress(0);
            setDownloadPreviewText(undefined);
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
            injectPrompt(nextChunk.text, nextChunk.id);
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
                    injectPrompt(nextChunk.text, nextChunk.id);
                }
            }
        }


    }, [chunks, completedStreams, currentChunkBeingPromptedIndex, currentCompletedStream, injectPrompt, voices.selected, isPromptingPaused])

    return { downloadPreviewText, downloadCombinedFile, progress, setProgress, blobs, isFetching, wasPromptStopped, setWasPromptStopped, chunks, voices, setVoices, isVoiceLoading, text, audioUrls, setAudioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNumber && +currentCompletedStream?.chunkNumber === chunks.length - 1, isLoading, setIsLoading, reset, is9ThChunk, reStartChunkProcess, setIs9thChunk, isPromptingPaused, setIsPromptingPaused, isBackPressed, setIsBackPressed, isLoopActive }

}

export default useAudioUrl;
