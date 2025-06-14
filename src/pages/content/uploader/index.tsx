import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTrigger
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import useAuthToken from "@/hooks/use-auth-token";
import { useToast } from "@/hooks/use-toast";
import { LISTENERS, PROMPT_INPUT_SELECTOR, SUBMIT_BUTTON_SELECTOR, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn, waitForButtonWithText, waitForElement } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import AlertPopup from "./alert-popup";
import Content from "./content";
import { set } from "react-hook-form";
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


	useEffect(() => {
		if (isActive) {
			wasActive.current = true;
		}
		if (!isActive && wasActive.current && !wasPopup.current) {
			window.location.reload();
		}
	  }, [isActive]);
	  
	  
	  
	  
	// sending the auth status to the background script
	useMemo(() => {
		chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
	}, [isAuthenticated]);

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

	// for the name sign-in case case where there is no redirection that happens
	// TODO: This needs to be improved and made more specific
	useEffect(() => {
		if (!showRoutePopup) return;	
		let lastPath = window.location.pathname;
		const interval = setInterval(() => {
		const current = window.location.pathname;
		if (current !== lastPath) {
			lastPath = current;
			if (current !== "/onboarding") {
				console.log('NOT ONBOARDING');
				setShowRoutePopup(false);
				onOpenChange(true);
				localStorage.removeItem("pi/onload-open");
				clearInterval(interval);
			}
		}
		}, 200);
	}, [showRoutePopup]);

	useEffect(() => {
		console.log('checking for gptr/onload-open');
		isInitialRender.current = true; // Set true initially
		if (localStorage.getItem("pi/onload-open") === "true") {
			setShowRoutePopup(false);
			onOpenChange(true);
			localStorage.removeItem("pi/onload-open");
		}
		return () => {
			isInitialRender.current = false; // Set false on cleanup (after the first render)
		};
	}, []);

	
    useEffect(() => {
		const onboardingMarkers = [
			'Sorry to interrupt',
			'better when you create an account',
		];
		const popupMarkers = [
		...onboardingMarkers,
		'Just checking',
		"Try Pi's new features",
		];
	  
		const detectPopup = () => {
			const headings = Array.from(document.querySelectorAll('.t-heading-m'));
			return headings.some(h => {
			  const txt = h.textContent?.trim() ?? '';
		  
			  // if this is one of the onboarding modals, set the onload flag
			  if (onboardingMarkers.some(marker => txt.includes(marker))) {
				localStorage.setItem('pi/onload-open', 'true');
			  }
		  
			  // return true for any of our popups
			  return popupMarkers.some(marker => txt.includes(marker));
			});
		  };
		  
	  
		const interval = setInterval(() => {
		  if (detectPopup()) {
			console.log('popup detected');
			if (!wasPopup.current) {
			  console.log('detected popup');
			  if (isActive) {
				console.log('closing overlay/wasPopup assignment');
				wasPopup.current = true;
			  	setIsActive(false);
			  }
			  toast({
				description: "Pi Reader Alert: pi.ai has opened a pop-up that’s blocking the extension. Please close it to continue using Pi Reader.",
				duration: 15000,
				style: TOAST_STYLE_CONFIG,
			  });
			}
		  } else if (wasPopup.current && !isActive) {
			console.log("🟢 overlay cleared, reopening");
			wasPopup.current = false;
			onOpenChange(true);
		  }
		}, 1000);
	  
		return () => clearInterval(interval);
	  }, [toast, isActive]);
	  

	const onOpenChange = async (open: boolean) => {
		console.log('trying to open the overlay...')
		if (wasPopup.current) {
			return toast({
				description: "Pi Reader Alert: pi.ai has opened a pop-up that’s blocking the extension. Please close it to continue using Pi Reader.",
				duration: 15000,
				style: TOAST_STYLE_CONFIG,
			})
		}
		// we can probably remove this 2.5 second wait
		// const SubmitBtn = await waitForElement(SUBMIT_BUTTON_SELECTOR, 2_500);
		const SubmitBtn = document.querySelector(SUBMIT_BUTTON_SELECTOR);
		if (!SubmitBtn) {
			const continueBtn = await waitForButtonWithText("Continue to Pi Classic", 4_000);
			if (continueBtn) {
				localStorage.setItem("pi/onload-open", "true");
				setShowRoutePopup(true);
				continueBtn.click();
			} else {
				return;
			}
			while (true) {
				// wait a second to make sure we are not clicking too fast
				await new Promise(resolve => setTimeout(resolve, 1000));
				const nxtBtn = await waitForButtonWithText("Next", 4_000);
				if (nxtBtn) {
					nxtBtn.click();
				} else {
					break;
				}
			}
		} 
		
		if (SubmitBtn) {
			console.log('overlay opened');
			setIsActive(open);
			// Skip the automatic call during the initial render
			if (isInitialRender.current) {
				isInitialRender.current = false; // Set it to false after first render
				return;
			}
		}	
			
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
