/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

/** Extension that changes matching tag when one of tags is changed */

define(function (require, exports, module) {
    "use strict";
   
    var fileUtils = brackets.getModule("file/FileUtils"),
        mainViewManager = brackets.getModule("view/MainViewManager"),
        editorManager  = brackets.getModule("editor/EditorManager"),
        HTMLUtils = brackets.getModule("language/HTMLUtils"),
        liveDevelopmentUtils = brackets.getModule("LiveDevelopment/LiveDevelopmentUtils"),
        codeMirror = brackets.getModule("thirdparty/CodeMirror/lib/codemirror"),
        cm,
        editor,
        document,
        matchingTag,
        previousTagName,
        marker;

    
    function isSingleTag(tag) {
        var noOpenTag = tag.open === null || tag.open === undefined;
        var noClosedTag = tag.close === null || tag.close === undefined;
        return noOpenTag || noClosedTag;
    }
    
    function nameChanged(currentTag) {
        return currentTag.tagName !== previousTagName;
    }
    
    function cursorOnTag(cursorPos) {
        var tagInfo = HTMLUtils.getTagInfo(editor, cursorPos);
        return tagInfo.tagName && tagInfo.tagName.match(/^([a-z0-9]+)$/i);
    }
    
    function resetCurrentTag() {
        matchingTag = null;
        previousTagName = null;
    }
    
    function trackCurrentTag(cursorPos) {
        var mt = codeMirror.findMatchingTag(cm, cursorPos);
        var tagInfo = HTMLUtils.getTagInfo(editor, cursorPos);
        if (!isSingleTag(mt)) {
            matchingTag = mt;
            previousTagName = tagInfo.tagName;
        } else {
            resetCurrentTag();
        }
    }
    
    function calculateReplaceRange(currentTag, cursorPos) {
        var replaceFrom,
            replaceTo,
            replaceRange = {
                from: null,
                to: null
            };
        if (matchingTag.at === 'open') {
            var chShift = 0,
                lineShift = cursorPos.line - matchingTag.open.from.line;
            // open and closed tags on the same line
            if (matchingTag.open.from.line === matchingTag.close.from.line) {
                chShift = currentTag.tagName.length - previousTagName.length;
                if (lineShift !== 0) { // split tag name with "enter"
                    chShift = 1;
                }
            }
            replaceFrom =  {
                ch: matchingTag.close.from.ch + 2 + chShift,
                line: matchingTag.close.from.line + lineShift
            };
            replaceTo = {
                ch: matchingTag.close.from.ch + 2 + chShift + matchingTag.close.tag.length,
                line: matchingTag.close.to.line + lineShift
            };
        } else {
            replaceFrom =  {
                ch: matchingTag.open.from.ch + 1,
                line: matchingTag.open.from.line
            };
            replaceTo = {
                ch: matchingTag.open.from.ch + 1 + matchingTag.open.tag.length,
                line: matchingTag.open.from.line
            };
        }
        replaceRange.from = replaceFrom;
        replaceRange.to = replaceTo;
        return replaceRange;
    }
    
    function highlightPairTag(mt) {
        var highlightFrom,
            highlightTo;
        if (mt.at === "open") {
            highlightFrom = mt.close.from;
            highlightTo = mt.close.to;
        } else {
            highlightFrom = mt.open.from;
            highlightTo = mt.open.to;
        }
        marker = cm.getDoc().markText(highlightFrom, highlightTo, {className: "CodeMirror-matchingtag"});
    }
    
    function clearHighlightMarker() {
        if (marker !== null && marker !== undefined) {
            marker.clear();
            marker = null;
        }
    }
    
    function changePairTag(currentTag, cursorPos) {
        // TODO: error when css code is mixed with html
        if (matchingTag === null) {
            return;
        }
        if (nameChanged(currentTag)) {
            var mt = codeMirror.findMatchingTag(cm, cursorPos);
            if (!isSingleTag(mt)) {  // both tags equal
                highlightPairTag(mt);
                resetCurrentTag();
                return;
            }
            var replaceRange = calculateReplaceRange(currentTag, cursorPos);
            editor.document.replaceRange(currentTag.tagName, replaceRange.from, replaceRange.to);
        }
    }
    
    function documentChangeHandler() {
        var cursorPos = editor.getCursorPos();
        var currentTag = HTMLUtils.getTagInfo(editor, cursorPos);
        if (cursorOnTag(cursorPos)) {
            changePairTag(currentTag, cursorPos);
        }
    }
    
    function keydownHandler() {
        var cursorPos = editor.getCursorPos();
        if (cursorOnTag(cursorPos)) {
            trackCurrentTag(cursorPos);
        } else {
            resetCurrentTag();
        }
    }
    
    function refreshEdidor() {
        editor = editorManager.getActiveEditor();
        document = editor !== null ? editor.document : null;
        cm = editor !== null ? editor._codeMirror : null;
    }
    
    function attachHandlers() {
        editor.on("keydown", keydownHandler);
        editor.on("cursorActivity", clearHighlightMarker);
        document.on("change", documentChangeHandler);
        document.addRef();
    }
    
    function detachHandlers() {
        editor.off("keydown", keydownHandler);
        editor.off("cursorActivity", clearHighlightMarker);
        document.off("change", documentChangeHandler);
        document.releaseRef();
    }
    
    function switchFileHandler(e, newFile, newPaneId, oldFile, oldPaneId) {
        if (oldFile !== null &&     liveDevelopmentUtils.isStaticHtmlFileExt(oldFile.fullPath)) {
            detachHandlers();
        }
        refreshEdidor();
        if (newFile !== null && liveDevelopmentUtils.isStaticHtmlFileExt(newFile.fullPath)) {
            attachHandlers();
        }
    }
    
    function addFileHandler(e, file){
        refreshEdidor();
        if (liveDevelopmentUtils.isStaticHtmlFileExt(file.fullPath)) {
            attachHandlers();
        }
    } 
    
    function removeFileHandler(e, file){
        if (liveDevelopmentUtils.isStaticHtmlFileExt(file.fullPath)) {
            detachHandlers();
        }
        refreshEdidor();
    }
    
    mainViewManager.on("workingSetAdd", addFileHandler);
    mainViewManager.on("workingSetRemove", removeFileHandler);
    mainViewManager.on("currentFileChange", switchFileHandler);
             
});