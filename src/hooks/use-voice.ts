import { LISTENERS, PI_VOICE_OTHER_INFO, VOICE } from "@/lib/constants";
import { Voice } from "@/pages/content/uploader/voice-selector";
import { useCallback, useEffect, useState } from "react";

const useVoice = () => {
    const [voices, setVoices] = useState<Voice>({ selected: VOICE, voices: [] });
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleVoiceReceived = useCallback((event: Event) => {
        const { detail } = event as Event & { detail: Voice };
        setIsLoading(true);
        const storedVoice = window.localStorage.getItem("gptr/voice");
        if (storedVoice) {
            detail.selected = storedVoice;
        }
        setVoices(detail);
        setIsLoading(false);
    }, []);

    const updateVoiceList =(apiVoices:any)=> {
        const voices = apiVoices.map((v:any) => {
            const voiceNumber = v.tag.match(/\d+/)?.[0] || "";
            return {
              voice: v.displayName,
              name: `voice${voiceNumber}`,
              bloop_color: '',
              description: PI_VOICE_OTHER_INFO[`voice${voiceNumber}`]?.info,
              preview_url: `https://pi.ai/public/media/voice-previews/voice-${voiceNumber}.mp3`,
              gender: PI_VOICE_OTHER_INFO[`voice${voiceNumber}`]?.gender

            };
        });

        if (voices.length > 0) {
            console.log('Voices Updated')
            setVoices({
                voices: voices,
                selected: voices[0].voice
            })
        }
    }
    const getVoices = useCallback((apiVoices:Voice) => {
        // setIsLoading(true);
        // const voicesEvent = new CustomEvent(LISTENERS.GET_VOICES)
        // window.dispatchEvent(voicesEvent)
        
        // [Currently Hardcoded: Finding a way to make it aligned with apis]
        let voices: Voice = {
            voices : [
                {voice: 'Pi 1 ✨', name: 'voice1', bloop_color: '', description: 'Voice 1', preview_url: 'https://pi.ai/public/media/voice-previews/voice-1.mp3'},
                {voice: 'Pi 2 ✨', name: 'voice2', bloop_color: '', description: 'Voice 2', preview_url: 'https://pi.ai/public/media/voice-previews/voice-2.mp3'},
                {voice: 'Pi 3 ✨', name: 'voice3', bloop_color: '', description: 'Voice 3', preview_url: 'https://pi.ai/public/media/voice-previews/voice-3.mp3'},
                {voice: 'Pi 4 ✨', name: 'voice4', bloop_color: '', description: 'Voice 4', preview_url: 'https://pi.ai/public/media/voice-previews/voice-4.mp3'},
                {voice: 'Pi 5', name: 'voice5', bloop_color: '', description: 'Voice 5', preview_url: 'https://pi.ai/public/media/voice-previews/voice-5.mp3'},
                {voice: 'Pi 6', name: 'voice6', bloop_color: '', description: 'Voice 6', preview_url: 'https://pi.ai/public/media/voice-previews/voice-6.mp3'},
                {voice: 'Pi 7', name: 'voice7', bloop_color: '', description: 'Voice 7', preview_url: 'https://pi.ai/public/media/voice-previews/voice-7.mp3'},
                {voice: 'Pi 8', name: 'voice8', bloop_color: '', description: 'Voice 8', preview_url: 'https://pi.ai/public/media/voice-previews/voice-8.mp3'}
            ],
            selected: "Pi 1 ✨",
        }
        setVoices(voices);

    }, []);

    // const handleVoiceChange = useCallback((voice: string) => {
    //     console.log('handleVoiceChange: ', voice, voices);
    //     if (window) window.localStorage.setItem("gptr/voice", voice);
    //     setVoices(p => ({ ...p, selected: voice }));
    // }, []);

    const handleVoiceChange = (voice: string) => {
        console.log('handleVoiceChange: ', voice, voices);
        if (window) window.localStorage.setItem("gptr/voice", voice);
        setVoices(p => ({ ...p, selected: voice }));
    };


    return { voices, setVoices, getVoices, handleVoiceChange, isLoading, updateVoiceList };
}

export default useVoice;