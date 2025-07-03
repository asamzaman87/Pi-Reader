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
import { cn, detectPopup, waitForButtonWithText, waitForElement } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
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
				<img src={LOGO} alt="Pi Reader Logo" className="w-6 h-6" />
				<span className="text-base font-semibold">Pi Reader</span>
			</div>
			<p className="text-sm leading-snug font-ui">
				To use the <strong>Pi Reader</strong> extension, please complete the setup
				process on this page. Once completed, the extension will open
				automatically. <strong>It is highly recommended to use an account via
				the "Log in" button instead of simply entering your name!</strong>
			</p>
			<p className="text-sm leading-snug font-ui mt-3 text-red-800">
				<strong>Note: You must be 18+ to use this extension.</strong>
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
	const isActiveRef = useRef(isActive);


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
		if (!document.getElementById("pi-reader-injected")) {
			const s = document.createElement('script');
			s.id = "pi-reader-injected";
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
						const active = window.localStorage.getItem("pi/active");
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
			const active = window.localStorage.getItem("pi/active");
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
		const isRedirectToLogin = window.localStorage.getItem("pi/redirect-to-login");
		if (isRedirectToLogin && isRedirectToLogin === "true" && isAuthenticated) {
			//console.log("redirecting to login");
			chrome.runtime.sendMessage({ type: "CONTENT_LOADED" }); //indicate to background script that content is loaded
		}
	}, [isAuthenticated, isActive]);

	// for the name sign-in case case where there is no redirection that happens
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
		const interval = setInterval(() => {
		  // 1) don’t start polling if we’re on /onboarding
		  if (window.location.pathname === '/onboarding') {
			return;
		  }
		  if (detectPopup()) {
			if (!wasPopup.current) {
			  if (isActiveRef.current) {
				wasPopup.current = true;
				isActiveRef.current = false;
			  }
			  setIsActive(false);
			  toast({
				description: "Pi Reader Alert: pi.ai has opened a pop-up that’s blocking the extension. Please resolve it to continue using Pi Reader. NOTE: Sign in using an account to minimize these pop-ups. You must be 18+ to use Pi Reader.",
				duration: 10000,
				style: TOAST_STYLE_CONFIG,
			  });
			}
		  } else if (wasPopup.current && !isActiveRef.current) {
			wasPopup.current = false;
			onOpenChange(true);
		  } else {
			wasPopup.current = false;
		  }
		}, 1000);
	  
		return () => clearInterval(interval);
	  }, [toast, isActive]);
	  
	/**
	 * Continuously watches the “/onboarding” page and clicks the first available button
	 * whose text matches one of the supplied labels in priority order.
	*/
	async function skipOnboardingFlow(firstRun?: boolean) {
		const btnTexts = ['do it later', 'my own topic', 'continue', 'next'];
	
		while (window.location.pathname === '/onboarding') {
			// wait a second before each check
			if (!firstRun) await new Promise(resolve => setTimeout(resolve, 1000));
		
			// look for the highest-priority button
			const btn = await waitForButtonWithText(btnTexts);
			if (btn && window.location.pathname === '/onboarding') {
				btn.click();
				firstRun = false;
			}
		}
	}
		
	
	const onOpenChange = async (open: boolean) => {
		if (detectPopup()) {
			setIsActive(false);
			return toast({
				description: "Pi Reader Alert: pi.ai has opened a pop-up that’s blocking the extension. Please resolve it to continue using Pi Reader.",
				duration: 15000,
				style: TOAST_STYLE_CONFIG,
			})
		}

		isActiveRef.current = open;	

		await Promise.race([
			waitForElement(SUBMIT_BUTTON_SELECTOR, 5_000),
			waitForElement(PROMPT_INPUT_SELECTOR, 5_000),
			waitForButtonWithText(["Continue"]),
      	]);

		if (!['/onboarding', '/talk', '/discover', '/profile'].includes(window.location.pathname)) {
			localStorage.setItem("pi/onload-open", "true");
			window.location.href = "https://pi.ai/talk";
		}

		if (window.location.pathname === '/onboarding') {
			localStorage.setItem("pi/onload-open", "true");
			setShowRoutePopup(true);
			await skipOnboardingFlow(true);
		} 
		
		if (window.location.pathname !== '/onboarding') {
			const triggerButton = document.querySelector(
				'button.z-10.bg-neutral-200.pl-4.text-neutral-900 > div[style*="transform: none;"]'
			);
			
			if (triggerButton) {
				const actionButton = document.querySelector(
					'button.group.z-10.flex.items-center.text-neutral-800'
				) as HTMLButtonElement | null;
			
				if (actionButton) {
					actionButton.click();
				}
			}
			if (!detectPopup()) {
				setIsActive(open);
			}
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
		window.localStorage.setItem("pi/active", String(isActive)); //set overlay state to storage
		if (isActive) {
			//set active overlay count
			const aoc = window.localStorage.getItem("pi/aoc");
			const count = aoc ? +aoc : 0;
			window.localStorage.setItem("pi/aoc", String(count + 1));

			//clear the origins (onClick and onInstall once overlay is opened)
			chrome.runtime.sendMessage({ type: "CLEAR_ORIGIN" });
		} else {
			//reset active overlay count
			window.localStorage.setItem("pi/aoc", "0");
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
							<img src={LOGO} alt="Pi Reader Logo" className="size-6" />
							{!minimised && (
								<>
									{isOnboarding
										? "Click to use Pi Reader"
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
