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
    
    function nameChanged(editedTagInfo) {
        return editedTagInfo.tagName !== previousTagName;
    }
    
    function documentChangeHandler() {
        console.log("document change");
        if (matchingTag === null) {
            return;
        }
        var cursorPos = editor.getCursorPos();
        var editedTagInfo = HTMLUtils.getTagInfo(editor, cursorPos);
        if (editedTagInfo.tagName) {
            if (nameChanged(editedTagInfo)) {
                var replaceRangeFrom,
                    replaceRangeTo;
                if (matchingTag.at === 'open') {
                    var closeTagShift = 0; // open and closed tags on the same line
                    if (matchingTag.open.from.line === matchingTag.close.from.line) {
                        closeTagShift = editedTagInfo.tagName.length - previousTagName.length;
                    }
                    replaceRangeFrom =  {
                        ch: matchingTag.close.from.ch + 2 + closeTagShift,
                        line: matchingTag.close.from.line
                    };
                    replaceRangeTo = {
                        ch: matchingTag.close.from.ch + 2 + closeTagShift + matchingTag.close.tag.length,
                        line: matchingTag.close.from.line
                    };
                } else {
                    replaceRangeFrom =  {
                        ch: matchingTag.open.from.ch + 1,
                        line: matchingTag.open.from.line
                    };
                    replaceRangeTo = {
                        ch: matchingTag.open.from.ch + 1 + matchingTag.open.tag.length,
                        line: matchingTag.open.from.line
                    };
                }
                var mt = codeMirror.findMatchingTag(cm, cursorPos);
                if (!isSingleTag(mt)) {  // both tags equal
                   // matchingTag = mt;
                   //    previousTagName = editedTagInfo.tagName;
                    matchingTag = null;
                    previousTagName = null;
                    console.log("2 change");
                    return;
                }
                console.log("1 change");
                // only first tag has been changed
                editor.document.replaceRange(editedTagInfo.tagName, replaceRangeFrom, replaceRangeTo);
            }
        }
    }
    
    function keydownHandler() {
        console.log("keydown");
        var cursorPos = editor.getCursorPos();
        var tagInfo = HTMLUtils.getTagInfo(editor, cursorPos);
        if (tagInfo.tagName) {
            //
            var mt = codeMirror.findMatchingTag(cm, cursorPos);
            if (!isSingleTag(mt)) {
                matchingTag = mt;
                previousTagName = tagInfo.tagName;
            }
            //
        } else {
            matchingTag = null;
            previousTagName = null;
        }
    }
    
    function switchFileHandler() {
        if (document !== undefined && document !== null) {
            document.releaseRef();
        }
        var filePath = mainViewManager.getCurrentlyViewedPath();
        editor = editorManager.getActiveEditor();
        document = editor.document;
        cm = editor._codeMirror;
        if (liveDevelopmentUtils.isStaticHtmlFileExt(filePath)) {
            // TODO: check mixed html/php
            editor.on("keydown", keydownHandler);
            document.on("change", documentChangeHandler);
            document.addRef();
            document.on("delete", function () {
                document.releaseRef();
            });
        }
    }
    
    mainViewManager.on("currentFileChange", switchFileHandler);
             
});