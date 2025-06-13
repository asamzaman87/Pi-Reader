import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTrigger
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import useAuthToken from "@/hooks/use-auth-token";
import { useToast } from "@/hooks/use-toast";
import { LISTENERS, PROMPT_INPUT_SELECTOR, SUBMIT_BUTTON_SELECTOR, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { waitForElement } from "@/lib/utils"; 
import AlertPopup from "./alert-popup";
import Content from "./content";
export interface PromptProps {
	text: string | undefined
}
function RouteSpecificPopup({ onClose }: { onClose: () => void }) {

	const LOGO = chrome.runtime.getURL('logo-pi-reader.png');
	return (
		<div className="fixed top-10 right-10 bg-white text-black p-4 rounded-lg shadow-lg border w-80 max-w-[90vw] z-[9999]">
			<div className="flex items-center gap-2 mb-3">
				<img src={LOGO} alt="GPT Reader Logo" className="w-6 h-6" />
				<span className="text-base font-semibold">Pi Reader</span>
			</div>
			<p className="text-sm leading-snug font-ui">
				To use the <strong>Pi Reader</strong> extension, please complete the setup process at <strong>pi.ai</strong>. Once completed, the extension will open automatically.
			</p>
		</div>

	);
}

function Uploader() {
	const [showRoutePopup, setShowRoutePopup] = useState(false);
	const isInitialRender = useRef(true);
	const [prompts, setPrompts] = useState<PromptProps[]>([]);
	const [isActive, setIsActive] = useState<boolean>(false);
	const activateButton = useRef<HTMLButtonElement>(null);
	const [openTries, setOpenTries] = useState<number>(0);
	const [minimised, setMinimised] = useState<boolean>(true);
	const [confirmed, setConfirmed] = useState<boolean>(false);
	const [overActiveInterval, setOverlayAciveInterval] = useState<NodeJS.Timeout | null>(null);
	const [isOverlayFallback, setIsOverlayFallback] = useState<boolean>(true);
	const [isCancelDownloadConfirmation, setIsCancelDownloadConfirmation] = useState<boolean>(false);

	const { toast } = useToast();
	const { isAuthenticated } = useAuthToken();
	const LOGO = chrome.runtime.getURL('logo-pi-reader.png');
	const wasActive = useRef<boolean>(false);
	const wasPopup = useRef<boolean>(false);
	const isOnboarding = window.location.pathname === "/onboarding";

	// useEffect(() => {
	// 	if (!isActive) return;
	  
	// 	const checkOcclusion = () => {
	// 	  const overlay = document.querySelector<HTMLElement>('[data-pi-reader-dialog]');
	// 	  if (!overlay) return;
	  
	// 	  // sample the center of the overlay
	// 	  const { left, top, width, height } = overlay.getBoundingClientRect();
	// 	  const x = left + width  / 2;
	// 	  const y = top  + height / 2;
	  
	// 	  // who’s actually at that point?
	// 	  const hit = document.elementFromPoint(x, y);
	// 	  if (hit && !overlay.contains(hit)) {
	// 		// something else is covering us
	// 		console.log('Something else is covering us');
	// 		setIsActive(false);
	// 	  }
	// 	};
	  
	// 	// initial snap-check + poll
	// 	checkOcclusion();
	// 	const iv = setInterval(checkOcclusion, 200);
	  
	// 	return () => clearInterval(iv);
	//   }, [isActive]);


	useEffect(() => {
		if (isActive) {
			wasActive.current = true;
		}
		if (!isActive && wasActive.current && !wasPopup.current) {
			window.location.reload();
		}
		
		wasPopup.current = false;
		if (!isActive) return;
	  
		const checkForPiAIPopup = () => {
		  // Pi.ai's "Just checking..." modal is that full-screen fixed div:
          // TODO: fix this as needed
		  const piPopup = document.querySelector('div.fixed.inset-0.bg-neutral-50');
		  if (piPopup) {
			wasPopup.current = true;
			setIsActive(false);
		  }
		};
	  
		// immediate snap-check + poll every 200ms
		checkForPiAIPopup();
		const iv = setInterval(checkForPiAIPopup, 200);
		return () => clearInterval(iv);
	  }, [isActive]);
	  
	  
	  
	  
	// sending the auth status to the background script
	useMemo(() => {
		chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
	}, [isAuthenticated]);


	// CHATGPT TODO: In this case if a user onload happens to be on the onboarding page then we should automatically click the continue to pi classic and next buttons for them currently they are only automatically triggered if i am on the page and then refresh it and not if the onboarding was just opened through my extension. 
	useEffect(() => {
		if (!document.getElementById("gpt-reader-injected")) {
			const s = document.createElement('script');
			s.id = "gpt-reader-injected";
			s.src = chrome.runtime.getURL('injected.js');
			(document.head || document.documentElement).appendChild(s);

			chrome.runtime.onMessage.addListener((message) => {
				// console.log('Message: ', message);
				if (message.type === "OPEN_POPUP") {
					//if origin is not verified, verify it
					if (message.payload === "VERIFY_ORIGIN") {
						chrome.runtime.sendMessage({ type: "VERIFY_ORIGIN" });
						return
					}

					//if origin is verified, open the overlay
					if (message.payload === "ORIGIN_VERIFIED") {
						const active = window.localStorage.getItem("gptr/active");
						//if overlay is set to closed, open the overlay
						if (active && active !== "true") {
							activateButton.current?.click();
						}
					}
				}
			})

		}

		chrome.runtime.sendMessage({ type: "CONTENT_LOADED" }); //indicate to background script that content is loaded

		//checking if user has already confirmed the extension
		const cnf = window.localStorage.getItem("pir/confirmation");
		setConfirmed(cnf === "true");



		const route = window.location.pathname;
		const routesToShowPopup = ["/onboarding"]; // define your routes here
		const routesToShowExtension = ["/talk", "/discover"];
		if (routesToShowPopup.includes(route)) {
			setShowRoutePopup(true);
			window.localStorage.setItem("pi-reader-onboarding", "true");
		} else if (routesToShowExtension.includes(route) ) {
			let userComeFromOnBoarding = window.localStorage.getItem("pi-reader-onboarding");
			if (userComeFromOnBoarding === 'true') {
				chrome.runtime.sendMessage({ type: "VERIFY_ORIGIN" });
				setIsActive(true);
				window.localStorage.setItem("pi-reader-onboarding", "false");
			}
		}

		if (routesToShowPopup.includes(route)) {

			setShowRoutePopup(true);
			// Automatically click the onboarding buttons
			const BUTTON_TEXTS = ["Continue to Pi Classic", "Next"];
			let attempts = 0;
			const MAX_ATTEMPTS = 50;

			const clickNextButton = () => {
				const buttons = Array.from(document.querySelectorAll("button"));
				const nextButton = buttons.find(
					btn => BUTTON_TEXTS.includes(btn.textContent?.trim() || "")
				);
				if (nextButton) {
					nextButton.click();
				}
			};

			// Retry click if new "Next" button appears after each step
			const interval = setInterval(() => {
				attempts += 1;
				clickNextButton();
				if (attempts > MAX_ATTEMPTS) clearInterval(interval);
			}, 500);

			return () => clearInterval(interval);
		}


	}, []);

	//toddo: refactor as this might exceed space
	useEffect(() => {
		const interval = setInterval(() => {
			const active = window.localStorage.getItem("gptr/active");
			if (active && active === "true") {
				setIsOverlayFallback(true);
			}
		}, 1000);
		setOverlayAciveInterval(interval);
		return () => {
			if (overActiveInterval) clearInterval(overActiveInterval);
		}
	}, [])

	useEffect(() => {
		//if redirection to login page is set and user is authenticated, open the overlay after 1s
		const isRedirectToLogin = window.localStorage.getItem("gptr/redirect-to-login");
		if (isRedirectToLogin && isRedirectToLogin === "true" && isAuthenticated) {
			//console.log("redirecting to login");
			chrome.runtime.sendMessage({ type: "CONTENT_LOADED" }); //indicate to background script that content is loaded
		}
	}, [isAuthenticated, isActive]);

	//check if the send button is present on the dom
	// const isSendButtonPresentOnDom = () => {
	// 	const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
	// 	return sendButton !== null;
	// }

	// //check if the speech button is present on the dom
	// const isComposerSpeechButtonPresentOnDom = () => {
	// 	const speechButton: HTMLDivElement | null = document.querySelector("[data-testid='composer-speech-button']");
	// 	return speechButton !== null;
	// }

	// //add speech found text to the input and open the popup
	// const addTextToInputAndOpen = (text: string) => {
	// 	const textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
	// 	if (textarea) {
	// 		textarea.innerHTML = `<p>${text}</p>`;
	// 		textarea.focus();
	// 		// setTimeout(()=>setIsActive(true), 200);
	// 		return
	// 	}
	// 	return toast({ description: chrome.i18n.getMessage("ongoing_conversation_error"), duration: 5000, style: TOAST_STYLE_CONFIG });
	// }

	// const isO1PreviewOrO1MiniModelSelected = () => {
	//   const isSupportedModel = (models: string | string[]) => MODELS_TO_REJECT.some((model) => models.includes(model));
	//   //checking if the user has a last used model stored in local storage
	//   if (userId) {
	//     const lastUsedModelKey = findMatchLocalStorageKey(userId);
	//     if (lastUsedModelKey) {
	//       const lastUsedModel = localStorage.getItem(lastUsedModelKey);
	//       if (lastUsedModel) {
	//         return isSupportedModel(lastUsedModel);
	//       }
	//     }
	//   }
	//   // if the user has not used a model before, check if the model switcher is present on the dom
	//   const modelSwitcher = document.querySelector('[data-testid="model-switcher-dropdown-button"]') as HTMLButtonElement;
	//   if (modelSwitcher) {
	//     return isSupportedModel(modelSwitcher.innerHTML);
	//   }
	//   return false
	// };

	// Avoid calling `onOpenChange` during the first render
	useEffect(() => {
		isInitialRender.current = true; // Set true initially
		if (localStorage.getItem("pi/onload-open") === "true") {
			console.log("onload-open");
			onOpenChange(true);
			localStorage.removeItem("pi/onload-open");
		} else {console.log("no pi/onload-open");}
		
		return () => {
			isInitialRender.current = false; // Set false on cleanup (after the first render)
		};
	}, []);

	const onOpenChange = async (open: boolean) => {
		if (window.location.href !== `https://pi.ai/talk` && window.location.href !== `https://pi.ai/discover`) return;
		if (document.querySelector('div.fixed.inset-0.bg-neutral-50')) {
			console.log('Pi.ai modal is already up — not opening ours.');
			return;
		}	  
		console.log('the location is', window.location.href);
		// TODO CHATGPT: I am having an issue here where as soon as the pi.ai is page loaded, pi.ai opens a pop-up and that pop-up ends up opening above our own overlay which just make the UI impossible to use. How can i solve that issue so if a pop-up ends up appearing over the page with the input bar and send button then we give priority to that.
		try {
			await waitForElement(PROMPT_INPUT_SELECTOR, 10000);
		  } catch (error) {
			return toast({ description: `Pi Reader is having trouble opening, continue signing in or refresh and try again`, duration: 8000, style: TOAST_STYLE_CONFIG });
		}
		const sendButton = document.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement;
		if (sendButton) {
			setIsActive(open);
		} else {
			return toast({ description: `Pi Reader is having trouble opening, continue signing in or refresh and try again`, duration: 8000, style: TOAST_STYLE_CONFIG });
		}
		
		// Skip the automatic call during the initial render
		if (isInitialRender.current) {
			isInitialRender.current = false; // Set it to false after first render
			return;
		}


		// console.log('Button Clicked: Open: ', open);
		// if (!open) {
		//   //show confirmation for cancel download if download is in progress
		//   const download = window.localStorage.getItem("gptr/download");
		//   if (download && download === "true") {
		//     setIsCancelDownloadConfirmation(true);
		//     return
		//   }
		//   setIsActive(false);
		//   return
		// }

		// const aoc = window.localStorage.getItem("gptr/aoc");
		// //return if overlay is already active.
		// if (open && aoc && +aoc > 0) {
		//   setIsOverlayFallback(true);
		//   return;
		// }

		// //redirect to login if click on button if not authorised
		// if (!isAuthenticated) {
		//   const currentPath = window.location.pathname;
		//   const isOnProfilePage = currentPath === "/profile/account";
		//   // const alreadyRedirected = window.localStorage.getItem("pir/alreadyRedirected");

		//   // console.log({ alreadyRedirected, isOnProfilePage });
		//   if (!isOnProfilePage) {
		//     window.localStorage.setItem("gptr/redirect-to-login", "true");
		//     chrome.runtime.sendMessage({ type: "SET_ORIGIN" });
		//     window.localStorage.setItem("pir/alreadyRedirected", "true");

		//     // Redirect to profile page
		//     window.location.href = "https://pi.ai/profile/account";
		//   }
		//   return;
		// }

		// window.localStorage.removeItem("gptr/redirect-to-login");

		// //check if the user has selected o1-preview or o1-mini and prompt them to select other models
		// // if(isO1PreviewOrO1MiniModelSelected()){
		// //   const {id} = toast({ description:"GPT Reader does not support o1 based models due to their slower speeds. Please switch to another ChatGPT model by using the model drop down on the top left.", duration:5000, style: TOAST_STYLE_CONFIG });
		// //   supportModelToast.current = id;
		// //   return;
		// // }
		// //clear the toast if model is supported
		// // if(supportModelToast.current) dismiss(supportModelToast.current);

		// //gpt has a new update, shows speech button by default instead of the send button until the user types in text
		// if (isComposerSpeechButtonPresentOnDom()) {
		//   //if the speech button is present on the dom, add speech found text to the input and open the popup
		//   addTextToInputAndOpen(chrome.i18n.getMessage("gpt_reader"));
		//   return setIsActive(true);
		// }

		// // if the send button is not present on the dom show error message
		// if (!isSendButtonPresentOnDom() && open) {

		//   setIsActive(false);
		//   setOpenTries(tries => tries + 1);
		//   if (openTries >= 1) {
		//     toast({ description: chrome.i18n.getMessage("chat_error"), style: TOAST_STYLE_CONFIG });
		//     setTimeout(() => setOpenTries(0), 5000);
		//   }
		//   return;
		// }

	}

	const handleConfirm = (state: boolean) => {
		if (!state) return onOpenChange(false);
		window.localStorage.setItem("pir/confirmation", String(state));
		setConfirmed(state)
	}

	useMemo(() => {
		// chrome.runtime.sendMessage({ type: "UPDATE_BADGE_STATE", state: isActive });
		window.localStorage.setItem("gptr/active", String(isActive)); //set overlay state to storage
		if (isActive) {
			//set active overlay count
			const aoc = window.localStorage.getItem("gptr/aoc");
			const count = aoc ? +aoc : 0;
			window.localStorage.setItem("gptr/aoc", String(count + 1));

			//clear the origins (onClick and onInstall once overlay is opened)
			chrome.runtime.sendMessage({ type: "CLEAR_ORIGIN" });
		} else {
			//reset active overlay count
			window.localStorage.setItem("gptr/aoc", "0");
		}
	}, [isActive])

	return (
		<>
			<Dialog open={isActive} onOpenChange={onOpenChange}>
				{
					!showRoutePopup &&
					<DialogTrigger asChild>
						<Button
							ref={activateButton}
							variant="outline"
							size="lg"
							onMouseOver={() => setMinimised(false)}
							onMouseOut={() => setMinimised(true)}
							className={cn(
								"font-ui shadow-md absolute flex justify-center items-center z-[101] top-60 right-0 rounded-l-full bg-white text-black hover:text-black p-2 border border-r-0 border-gray-200 transition-all",
								{
									"!z-[50]": isActive || isOverlayFallback,
								}
							)}
						>
							<img src={LOGO} alt="GPT Reader Logo" className="size-6" />
							{!minimised && (
								<>
									{isOnboarding
										? "Login to pi.ai to use Pi Reader"
										: `${chrome.i18n.getMessage("activate")} Pi Reader`}
								</>
							)}
						</Button>
					</DialogTrigger>
				}
				<DialogContent
					data-pi-reader-dialog
					onInteractOutside={(e: Event) => {
						e.preventDefault(); //prevents mask click close
					}}
					className={cn("font-ui bg-gray-100 dark:bg-gray-800 max-w-screen h-full border-none flex flex-col gap-6 font-ui", prompts?.length && "pb-0")}
				>
					{!confirmed && <AlertPopup setConfirmed={handleConfirm} />}
					{confirmed && <Content isCancelDownloadConfirmation={isCancelDownloadConfirmation} setIsCancelDownloadConfirmation={setIsCancelDownloadConfirmation} onOverlayOpenChange={onOpenChange} setPrompts={setPrompts} prompts={prompts} />}
				</DialogContent>
			</Dialog>
			<Toaster />
			{/* <RouteSpecificPopup onClose={() => setShowRoutePopup(false)} /> */}
			{
				showRoutePopup &&
				<RouteSpecificPopup onClose={() => setShowRoutePopup(false)} />
			}

		</>
	);
}

export default Uploader;
