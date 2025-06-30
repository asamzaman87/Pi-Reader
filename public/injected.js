function normalizeAlphaNumeric(str) {
  // This will keep all Unicode letters and digits
  return str.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

const loopThroughReaderToExtractMessageId = async (reader, args) => {
    let messageId = "";
    let conversationId = "";
    let createTime = ""
    let text = "";
    try {
        const jsonArgs = JSON.parse(args[1]?.body);
        const prompt = jsonArgs?.messages?.[0]?.content?.parts[0]; //extracting the prompt from the request
        text = jsonArgs?.messages?.[0]?.content?.parts[0];
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read();
            const decoder = new TextDecoder("utf-8");
            const textDecoded = decoder.decode(value);

            const messageIdMatch = textDecoded.match(/"id":\s*"([^"]+)"/g); // Extract the id using regex  
            const createTimeMatch = textDecoded.match(/"create_time":\s*([^,}\s]+)/); // Extract the id using regex
            const conversationIdMatch = textDecoded.match(/"conversation_id":\s*"([^"]+)"/); // Extract the id using regex  
            //extracting the message id from the response 
            if (messageIdMatch?.length) {
                //if there are multiple message ids, take the last one 
                //if there are 3 messaged id's  i.e. 1. id with role system 2. id with role user 3. id with role assistant we pick the last one(role assitant)
                const rawMesssageId = messageIdMatch.length > 1 ? messageIdMatch[messageIdMatch.length - 1] : messageIdMatch[0];
                messageId = rawMesssageId.replace(/"/g, "").replace(/id: /g, "");
            }
            if (conversationIdMatch) conversationId = conversationIdMatch[1];
            if (createTimeMatch) createTime = createTimeMatch[1];

            if (messageId && conversationId && createTime) {
                //sending the prompt to the content script
                const messageIdEvent = new CustomEvent("RECEIVED_MESSAGE_ID", { detail: { messageId, createTime, text: prompt } });
                window.dispatchEvent(messageIdEvent);
            }

            if (done) return { messageId, conversationId, createTime, text };// Exit loop when reading is complete
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('Stream was aborted');
        } else {
            console.error('An error occurred while reading the stream:', error);
        }
    }
    return { messageId, conversationId, createTime, text };
};

const CONVERSATION_ENDPOINT = "/chat";
const SYNTHESIS_ENDPOINT = "backend-api/synthesize";
const VOICES_ENDPOINT = "backend-api/settings/voices";
const { fetch: origFetch } = window;


// Wait for the page to load
window.addEventListener('load', function () {
  // Send a message to background to get cookies after page load
  chrome.runtime.sendMessage(
    { action: "getCookies", url: window.location.href },
    function (response) {
      // console.log("📜 Received Cookies:", response.cookies);
      // You can now use the cookies as needed in your content script
    }
  );
});

// window.fetch = async (...args) => {
//     console.log('Arguments : ', args);
//     const response = await origFetch(...args);
//     console.log('and : ', response);
//     const { url } = response;
//     const hasConversationEndpoint = url.includes(CONVERSATION_ENDPOINT);
//     const isSynthesisEndpoint = url.includes(SYNTHESIS_ENDPOINT);
//     const isVoicesEndpoint = url.includes(VOICES_ENDPOINT);

//     //getting the access token
//     if (response && url.includes('backend-api/me')) {
//         let accessToken;
//         if (args.length > 1 && args[1]?.headers) {
//             accessToken = args[1].headers.Authorization;
//         }

//         const responseData = await response.clone().json();

//         if (accessToken && responseData?.id && !responseData?.id?.startsWith('ua-')) {
//             const authReceivedEvent = new CustomEvent('AUTH_RECEIVED', {
//                 detail: { ...responseData, accessToken },
//             });
//             window.dispatchEvent(authReceivedEvent);
//         }
//     }

//     //signing out
//     if (response && url.includes('api/auth/signout')) {
//         const responseData = await response.clone().json();
//         if (responseData?.success) {
//             const signoutReceivedEvent = new CustomEvent('SIGNOUT_RECEIVED', {
//                 detail: responseData,
//             });
//             window.dispatchEvent(signoutReceivedEvent);
//         }
//     }

//     //read the stream to get the message id and conversation id
//     if (hasConversationEndpoint && args[1].method === 'POST') {
//         const clonedResponse = response.clone(); // Clone the response
//         const stream = clonedResponse.body; // Use the body of the cloned response
//         if (clonedResponse.status === 429) {
//             const rateLimitExceededEvent = new CustomEvent('RATE_LIMIT_EXCEEDED', {
//                 detail: "You have exceeded the hourly limit for Pi.ai. You will not be able to generate any more audio for around 1 hour.",
//             });
//             window.dispatchEvent(rateLimitExceededEvent);
//         }
//         if (stream) {
//             const reader = stream.getReader();

//             loopThroughReaderToExtractMessageId(reader, args)
//                 .then((data) => {
//                     // Dispatch custom event after stream reading is complete
//                     const event = new CustomEvent("END_OF_STREAM", {
//                         detail: { ...data } // Custom data if needed
//                     });
//                     window.dispatchEvent(event);
//                 })
//                 .catch(error => console.error("Error in stream reading:", error));
//         }
//     }

//     //get all voices
//     if (isVoicesEndpoint && args[1].method === "GET") {
//         const clonedResponse = response.clone(); // Clone the response
//         const voices = await clonedResponse.json(); // Use the body of the cloned response
//         const voicesEvent = new CustomEvent('VOICES', {
//             detail: voices,
//         });
//         window.dispatchEvent(voicesEvent);
//     }

//     if (isSynthesisEndpoint) {
//         const clonedResponse = response.clone(); // Clone the response
//         if (clonedResponse.status === 404) {
//             const rateLimitExceededEvent = new CustomEvent('ERROR', {
//                 detail: "Message Not Found. Please refresh the page and try again.",
//             });
//             window.dispatchEvent(rateLimitExceededEvent);
//         }
//     }

//     return response;
// };

const originalFetch = window.fetch;

// Intercept XMLHttpRequest
const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
//   console.log("XHR →", method, url);
  return originalXhrOpen.call(this, method, url, ...rest);
};


window.fetch = async function (...args) {
  let url = "";
  let method = "GET";
  let headers = {};
  if (typeof args[0] === "string") {
    url = args[0];
    method = args[1]?.method || "GET";
  } else if (args[0] instanceof Request) {
    url = args[0].url;
    method = args[0].method;
    headers = args[0].headers || {};
  }

  if (args[0] instanceof Request) {
    const req = args[0];
    const headers = req.headers;
    let headersObject = {};
    headers.forEach((value, key) => {
      headersObject[key] = value;
    });
    // console.log("📜 Request Headers:", headersObject);
  }
  
// Convert Headers object to plain object and log it
  // Log headers before sending the request (if present)
  if (headers instanceof Headers) {
    let headersObject = {};
    headers.forEach((value, key) => {
      headersObject[key] = value; // Convert to a plain object
    });
    // console.log("📜 Request Headers:", headersObject); // Log the headers as a plain object
  } else if (headers) {
    // console.log("📜 Request Headers (Object):", headers);
  } else {
    // console.log("📜 No Headers Found");
  }

  // console.log("📜 Request Headers:", headers, url); // Log the headers
  const hasConversationEndpoint = url.includes(CONVERSATION_ENDPOINT);

  const response = await originalFetch.apply(this, args);
  let targetText = "";
  if (hasConversationEndpoint && method === 'POST') {
    const req = JSON.parse(args[1].body);
    const text = req.text || "";
    const markerPos = text.lastIndexOf("<<<");
    targetText = markerPos >= 0
        ? text.slice(markerPos + 3)
        : text;
    const clonedResponse = response.clone();
    // const stream = clonedResponse.body;
    if (clonedResponse.status !== 200) {
        const generalErrorEvent = new CustomEvent('GENERAL_ERROR', {
            detail: "Something went wrong with the chat endpont.",
        });
        window.dispatchEvent(generalErrorEvent);
    }
    // if (stream) {
    //     const reader = stream.getReader();
    //     loopThroughReaderToExtractMessageId(reader, args)
    //             .then((data) => {
    //                 // Dispatch custom event after stream reading is complete
    //                 const event = new CustomEvent("END_OF_STREAM", {
    //                     detail: { ...data } // Custom data if needed
    //                 });
    //                 window.dispatchEvent(event);
    //             })
    //             .catch(error => console.error("Error in stream reading:", error));
    // }
  }
  try {
    // Clone so we don't consume original response
    const clone = response.clone();
    // General rate limiting toast that we'll show
    if (clone.status === 429 && !hasConversationEndpoint) {
       const event = new CustomEvent("GENERAL_RATE_LIMIT", {
            detail: 'It seems like you have exceeded the limit of pi.ai, if you notice issues then please refresh or try again after a few seconds.',
       });
       window.dispatchEvent(event);
    }
    const contentType = clone.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await clone.json();
      // console.log("📥 Response JSON:", data);
    } else if (contentType.includes("text")) {
        const raw = await clone.text();
        const events = [];
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
              const parsedData = JSON.parse(data);
              events.push({ event, data: parsedData });
            } catch (e) {
              console.warn("❗ Failed to parse SSE data:", data);
            }
          }
        }

        const actual = events
          .filter(ev => ev.event === "partial" && ev.data.text)
          .map(ev => ev.data.text)
          .join("");

        // ── Compare normalized actual vs. targetText ──
        const normActual = normalizeAlphaNumeric(actual);
        const normTarget = normalizeAlphaNumeric(targetText);
        const mismatch = normActual !== normTarget;

        if (mismatch) {
          const generalErrorEvent = new CustomEvent('GENERAL_ERROR', {
            detail: "Something went wrong with the chat endpont.",
          });
          window.dispatchEvent(generalErrorEvent);
        } else {
          window.dispatchEvent(new CustomEvent("PI_CHAT_STREAM", { detail: events }));
        }
        
      
        // console.log("✅ Parsed SSE Events:", events);
    } else if (contentType.includes("event-stream")) {
      // console.log("📥 [SSE Stream] — use reader to process this");
    } else {
      // console.log("📥 Unknown Response Type:", contentType);
    }
  } catch (err) {
    // console.error("❌ Error reading response:", err);
  }

  return response; 
};

window.addEventListener("GET_TOKEN", () => {
    if (window && window?.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken) {
        const accessToken = window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken;
        const userId = window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.user.id;
        const authEvent = new CustomEvent("AUTH_RECEIVED", {
            detail: { accessToken, userId },
        });
        window.dispatchEvent(authEvent);
    }
})

//get all the listed voices
window.addEventListener("GET_VOICES", async () => {
    if (window && window?.__reactRouterContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken) {
        // console.log("GET_VOICES")
        const response = await fetch("https://Pi.ai.com/backend-api/settings/voices", { headers: { "authorization": `Bearer ${window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken}` } });
        const data = await response.json();
        const voicesEvent = new CustomEvent("VOICES", {
            detail: data,
        });
        window.dispatchEvent(voicesEvent);
    }
})

//stop conversation
window.addEventListener("STOP_CONVERSATION", async (e) => {
    if (window && window?.__reactRouterContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken) {
        const { conversation_id } = e.detail;
        const response = await fetch("https://Pi.ai.com/backend-api/stop_conversation", { method: "POST", body: JSON.stringify({ conversation_id }), headers: { "authorization": `Bearer ${window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken}` } });
        const data = await response.json();
        const conversationStoppedEvent = new CustomEvent("CONVERSATION_STOPPED", {
            detail: data,
        });
        window.dispatchEvent(conversationStoppedEvent);
    }
})