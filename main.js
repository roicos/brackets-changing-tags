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
        previousTagName;

    
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
        return tagInfo.tagName;
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
    
    function calculateReplaceRange(currentTag) {
        var replaceFrom,
            replaceTo,
            replaceRange = {
                from: null,
                to: null
            };
        if (matchingTag.at === 'open') {
            var closeTagShift = 0;
            // open and closed tags on the same line
            if (matchingTag.open.from.line === matchingTag.close.from.line) {
                closeTagShift = currentTag.tagName.length - previousTagName.length;
            }
            replaceFrom =  {
                ch: matchingTag.close.from.ch + 2 + closeTagShift,
                line: matchingTag.close.from.line
            };
            replaceTo = {
                ch: matchingTag.close.from.ch + 2 + closeTagShift + matchingTag.close.tag.length,
                line: matchingTag.close.from.line
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
    
    function changePairTag(currentTag, cursorPos) {
        if (matchingTag === null) {
            return;
        }
        if (nameChanged(currentTag)) {
            var mt = codeMirror.findMatchingTag(cm, cursorPos);
            if (!isSingleTag(mt)) {  // both tags equal
                resetCurrentTag();
                return;
            }
            var replaceRange = calculateReplaceRange(currentTag);
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
    
    function setGlobalVariables() {
        editor = editorManager.getActiveEditor();
        document = editor.document;
        cm = editor._codeMirror;
    }
    
    function attachHandlers() {
        editor.on("keydown", keydownHandler);
        document.on("change", documentChangeHandler);
        document.addRef();
        document.on("delete", function () {
            document.releaseRef();
        });
    }
    
    function switchFileHandler() {
        if (document !== undefined && document !== null) {
            document.releaseRef();
        }
        setGlobalVariables();
        var filePath = mainViewManager.getCurrentlyViewedPath();
        if (liveDevelopmentUtils.isStaticHtmlFileExt(filePath)) {
            // TODO: check mixed html/php
            attachHandlers();
        }
    }
    
    mainViewManager.on("currentFileChange", switchFileHandler);
             
});