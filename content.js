// Message passing for delete/restore (from interactComments.js)
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.message === "delete") {
            changeComments("del");
        }
        if (request.message === "restore"){ 
            changeComments("restore");
        }
    }
);

// Taken from stack overflow, used to detect changes in DOM
var observeDOM = (function(){
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    return function( obj, callback ){
      if( !obj || !obj.nodeType === 1 ) return; // validation
      if( MutationObserver ){
        // define a new observer
        var obs = new MutationObserver(function(mutations, observer){
            callback(mutations);
        })
        // have the observer observe foo for changes in children
        obs.observe( obj, { childList:true, subtree:true });
      }
      else if( window.addEventListener ){
        obj.addEventListener('DOMNodeInserted', callback, false);
        obj.addEventListener('DOMNodeRemoved', callback, false);
      }
    }
})();

/* On page (re)load, load variables from storage and run changeComments(). Then 
   pause 3s to let the rest of the 20+ fb elements to update. This prevents
   changeComments() from running 20+ times. The 'paused' flag prevents autoDelete
   from running due to a refresh-induced DOM change, it is referenced in the 
   function after this one */
var percent;
var autoDelete;
var minWords;
var paused = false;

function go() {
    chrome.storage.sync.get(function(data) {
        percent = data.percent;
        autoDelete = data.autoDelete;
        minWords = data.minWords;
        if (autoDelete) {
            changeComments("del");
            iconRed(true); // set theme red
        }else{
            changeComments("restore");
            iconRed(false); // set theme blue
        }
    });
    console.log("This page is (re)loading, waiting 3000 ms");
    var paused = true;
    setTimeout(function(){ paused = false}, 3000);
}
go();

// If the news feed updates (but not refresh), remove comments (if autoDelete on)
var feed = document.querySelectorAll("[role=feed]")[0];
observeDOM( feed, function(){
    if (!paused && autoDelete){
        changeComments("del");
    }
});

// Update variables if they change in storage
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (key in changes) {
        if (key === "percent") {
            chrome.storage.sync.get("percent", function(data) {
                percent = data.percent;
                console.log("percent updated to: " + percent)
            });
        }else if (key === "autoDelete") {

            // update and apply changeComments()
            chrome.storage.sync.get("autoDelete", function(data) {
                autoDelete = data.autoDelete;
                console.log("autoDelete updated to: " + autoDelete)
                if (autoDelete) {
                    changeComments("del");
                    iconRed(true);
                }else{
                    changeComments("restore");
                    iconRed(false);
                }
            });
        }else if (key === "minWords") {
            chrome.storage.sync.get("minWords", function(data) {
                minWords = data.minWords;
                console.log("minWords updated to: " + minWords)
            });
        }
    }
});

// Keyboard shortcuts for delete/restore
document.onkeyup = function(e) {
    if (e.which == 88 && e.altKey) {
        changeComments("del");
    }else if(e.which == 90 && e.altKey) {
        changeComments("restore");
    }
}

// Delete/restore comments based on settings
function changeComments(option) {
    checkVars();
    if (option == "del") {
        console.log("Deleting comments with autoDelete: " + autoDelete +   ", percent: " + percent + ", minWords: " + minWords);
    }else if (option == "restore") {
        console.log("Restoring comments with autoDelete: " + autoDelete +   ", percent: " + percent + ", minWords: " + minWords);
    }
    // select all comments by class, then parse through comment and tagged friends
    // portion, represented by <span> or <a> tag
    var l = document.querySelectorAll("span._3l3x");
    if (l.length == 0) {
        // New facebook UI involves new tags 
        l = document.querySelectorAll("div[aria-label*='Comment by '], div[aria-label*='Reply by ']");
        var i;
        for (i = 0; i<l.length; i++) {
            var comment = l[i];
            var spanWordLength = 0;
            var aTotal = 0;
            var tTotal = 0;

            // tagged/non-tagged comments are described in this list
            var commentParent = comment.querySelectorAll("div[dir='auto']")[0].childNodes;
            var j;
            for (j = 0; j < commentParent.length; j++){
                elem = commentParent[j]
                if (elem.nodeName == "A") {
                    // tagged friend
                    aTotal += elem.innerText.length;
                } else if (elem.nodeName == "#text" && elem.textContent.trim() != "") {
                    // non tagged friend text and not whitespace
                    spanWordLength += elem.textContent.trim().split(" ").length;
                    tTotal += elem.textContent.trim().length;
                }
            }

            // console.log(aTotal/(aTotal + spanTotal), comment.innerText);

            // act on comment if it fulfills settings criteria
            if (aTotal/(aTotal + tTotal)*100 >= parseInt(percent) || spanWordLength <= parseInt(minWords)) {
                divSection = comment.closest("li");
                if (option === "del") {
                    slideOut(divSection);
                }else{
                    slideIn(divSection);
                }
            }
        }
        return
    }

    // old facebook UI 
    var i;
    for (i = 0; i<l.length; i++){
        var comment = l[i];
        var spanWordLength = 0;
        var aTotal = 0;
        var spanTotal = 0;
        var aList = comment.querySelectorAll("a"); // Tagged friend
        var spanList = comment.querySelectorAll("span"); // Normal comment
        var j;
        for (j = 0; j < aList.length; j++){
            aTotal += aList[j].innerText.length;
        }
        for (j = 0; j < spanList.length; j++){
            // Ignore whitespace between tagged names
            if (spanList[j].classList.contains("whitespace")) {
                continue;
            }
            spanTotal += spanList[j].innerText.length;
            spanWordLength += spanList[j].innerText.split(" ").length - 1;
        }
        // console.log(aTotal/(aTotal + spanTotal), comment.innerText);

        // act on comment if it fulfills settings criteria
        if (aTotal/(aTotal + spanTotal)*100 >= parseInt(percent) || spanWordLength <= parseInt(minWords)) {
            divSection = comment.closest("li");
            if (option === "del") {
                slideOut(divSection);
            }else{
                slideIn(divSection);
            }
        }
    }
}

function checkVars() {
    if (typeof percent == "undefined" || typeof minWords == "undefined" || typeof autoDelete == "undefined") {
        chrome.storage.sync.get(function(data) {
            percent = data.percent;
            autoDelete = data.autoDelete;
            minWords = data.minWords;
            if (autoDelete) {
                changeComments("del");
                iconRed(true); // set theme red
            }else{
                changeComments("restore");
                iconRed(false); // set theme blue
            };
        });
    };
}

// Delete/restore animations
function slideOut(divSection) {
    if (divSection.classList.contains("slide-in")) {
        divSection.classList.remove("slide-in")
    };
    divSection.classList.add("slide-out");
    setTimeout(function() {
        divSection.style.display = "none";
    }, 195);
}
function slideIn(divSection) {
    divSection.style.display = "block";
    if (divSection.classList.contains("slide-out")) {
        divSection.classList.remove("slide-out")
    };
    divSection.classList.add("slide-in");
}

function iconRed(set) {
    chrome.runtime.sendMessage({
        action: 'iconRed',
        value: set
    });
}
