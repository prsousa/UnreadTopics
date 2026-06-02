var textarea = $("textarea#message, .quickReplyContent > textarea");
var imgurUploadBox, imgurUploadingBox, fileinput;

if (textarea.length === 1) {
    // Adiciona classe de preparação temporária para evitar flashing visual
    $("#postmodify").addClass("post-reply-split-preparing");

    chrome.storage.sync.get({ postReplySplitLayout: "0" }, function(items) {
        var useSplitLayout = items.postReplySplitLayout === "1";
        
        setUpload();

        if (useSplitLayout) {
            var parts = getPostReplyEditorParts();
            if (parts) {
                enablePostReplySplitLayout(parts);
            }
        }
        
        $("#postmodify").removeClass("post-reply-split-preparing");
    });
}


function addImageTag(url) {
    console.log(url);

    var caretPos = textarea[0].selectionStart;
    var textAreaTxt = textarea.val();
    var txtToAdd = "[img]" + url + "[/img]\n";

    textarea.val(textAreaTxt.substring(0, caretPos) + txtToAdd + textAreaTxt.substring(caretPos));
}

function fileDragHover(e) {
    e.stopPropagation();
    e.preventDefault();
    imgurUploadBox.removeClass("hover").addClass(e.type == "dragover" ? "hover" : "");
}

function fileSelectHandler(e) {
    fileDragHover(e);
    var files = e.originalEvent.target.files || e.originalEvent.dataTransfer.files;
    // var file = files[0];
    // var xhr = new XMLHttpRequest();

    // if (file.type !== "image/jpg" && file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/gif") {
    //     alert("Por favor, envia apenas imagens JPG, PNG, ou GIF.");
    //     return;
    // }

    // console.log("Drag & Drop");

    // upload(file, function(link) {
    //     addImageTag(link);
    // });

    // fileinput.val(null);
 
    var error = false;
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        
        // Verifica se o tipo de ficheiro é suportado ou se é uma imagem HEIC/HEIF
        var isSupportedImage = 
            file.type === "image/jpg" || 
            file.type === "image/jpeg" || 
            file.type === "image/png" || 
            file.type === "image/gif";
            
        var isHeicImage = window.HeicHandler && window.HeicHandler.isHeic(file);

        if (!isSupportedImage && !isHeicImage) {
            error = true;
        }
        else {
            console.log("Ficheiro selecionado para upload:", file.name);

            upload(file, function(link) {
                addImageTag(link);
            });
        }
    }
    
    if (error) {
        alert("Por favor, envie apenas imagens do tipo JPG, PNG, GIF ou HEIC. Os ficheiros não suportados foram ignorados.");
    }
    fileinput.val(null);

}

function getUploadInsertionTarget() {
    var resizer = $("#" + textarea.attr("id") + "_resizer");
    var next = textarea.next();

    if (resizer.length > 0) {
        return resizer;
    }

    if (next.length > 0 && next.attr("id") !== "imgur-upload-container") {
        return next;
    }

    return textarea;
}

function isLikelyEditorResizeBar(element) {
    var box = element.getBoundingClientRect();
    var textAreaBox = textarea[0].getBoundingClientRect();
    var text = $.trim($(element).text());
    var markerText = (
        element.id + " " +
        element.className + " " +
        element.getAttribute("role") + " " +
        element.getAttribute("aria-label") + " " +
        element.getAttribute("title")
    ).toLowerCase();

    return (
        markerText.indexOf("resize") !== -1 ||
        markerText.indexOf("resizer") !== -1 ||
        markerText.indexOf("handle") !== -1 ||
        markerText.indexOf("grip") !== -1 ||
        (
            box.height > 0 &&
            box.height <= 20 &&
            box.width >= textAreaBox.width * 0.5 &&
            text.length === 0 &&
            $(element).find("input, textarea, select, button").length === 0
        )
    );
}

function keepUploadBelowEditorResizeBar() {
    var uploadContainer = $("#imgur-upload-container");
    var resizer = $("#" + textarea.attr("id") + "_resizer");
    var next = uploadContainer.next();

    if (resizer.length > 0 && !uploadContainer.prev().is(resizer)) {
        uploadContainer.insertAfter(resizer);
        return;
    }

    if (next.length > 0 && isLikelyEditorResizeBar(next[0])) {
        uploadContainer.insertAfter(next);
    }
}

function watchEditorResizeBar() {
    keepUploadBelowEditorResizeBar();
    window.setTimeout(keepUploadBelowEditorResizeBar, 250);
    window.setTimeout(keepUploadBelowEditorResizeBar, 1000);
    window.setTimeout(keepUploadBelowEditorResizeBar, 2500);

    if (window.MutationObserver) {
        var observer = new MutationObserver(keepUploadBelowEditorResizeBar);
        var observerTarget = textarea.parent().parent()[0] || textarea.parent()[0];
        observer.observe(observerTarget, { childList: true });
        window.setTimeout(function() {
            observer.disconnect();
        }, 5000);
    }
}

function enableEditorResizeFallback() {
    var textareaId = textarea.attr("id");

    if (!textareaId) {
        return;
    }

    var resizer = $("#" + textareaId + "_resizer");

    if (resizer.length === 0) {
        return;
    }

    resizer.off("mousedown.imgurResize").on("mousedown.imgurResize", function(e) {
        if (e.which && e.which !== 1) {
            return;
        }

        var startY = e.pageY;
        var startHeight = textarea.height();
        var richEditorFrame = $("#html_" + textareaId);

        e.preventDefault();

        $(document)
            .off(".imgurResize")
            .on("mousemove.imgurResize", function(moveEvent) {
                var newHeight = Math.max(50, startHeight + moveEvent.pageY - startY);

                textarea.height(newHeight);
                richEditorFrame.height(newHeight);
                moveEvent.preventDefault();
            })
            .on("mouseup.imgurResize", function() {
                $(document).off(".imgurResize");
            });
    });
}

function setUpload() {
    //title='Escolhe ou arrasta uma imagem para a introduzires no post'
    var uploadContainer = $("<div id='imgur-upload-container'><div id='upload' class='imgurBox'>Inserir Imagem</div><div id='uploading' class='imgurBox'>&nbsp;</div><input id='file-input' type='file' name='image' multiple/></div>");
    uploadContainer.insertAfter(getUploadInsertionTarget());
    watchEditorResizeBar();
    enableEditorResizeFallback();

    imgurUploadBox = $("#upload.imgurBox");
    imgurUploadingBox = $("#uploading.imgurBox");
    fileinput = $("input#file-input");

    imgurUploadBox.bind("dragover", fileDragHover);
    imgurUploadBox.bind("dragleave", fileDragHover);
    imgurUploadBox.bind("drop", fileSelectHandler);
    fileinput.bind("change", fileSelectHandler);

    imgurUploadBox.click(function(e) {
        e.preventDefault();
        fileinput.click();
    });

    // Add the paste event listener
    window.addEventListener("paste", function(e) {
        pasteHandler(e, function(file) {
            console.log("Paste");

            //var URLObj = window.URL || window.webkitURL;
            //var pseudoURL = URLObj.createObjectURL(file);
            if (confirm("Inserir imagem do clipboard?")) {
                upload(file, function(link) {
                    addImageTag(link);
                });
            }
        });
    });
}

function getPostReplyEditorParts() {
    var postForm = $("#postmodify");
    var previewSection = $("#preview_section");
    var editHeader = previewSection.nextAll(".cat_bar").first();
    var editFrame = editHeader.next("div");
    var messageBlock = textarea.closest("div").parent().parent();

    if (
        postForm.length === 0 ||
        previewSection.length === 0 ||
        editHeader.length === 0 ||
        editFrame.length === 0 ||
        messageBlock.length === 0
    ) {
        return null;
    }

    return {
        postForm: postForm,
        previewSection: previewSection,
        previewBreak: previewSection.next("br"),
        editFrame: editFrame,
        editHeader: editHeader,
        messageBlock: messageBlock
    };
}

function enablePostReplySplitLayout(parts) {
    var splitLayout = $("#post-reply-split-layout");

    if (splitLayout.length === 0) {
        splitLayout = $(
            "<div id='post-reply-split-layout'>" +
                "<div id='post-reply-editor-pane' class='post-reply-split-pane'></div>" +
                "<div id='post-reply-preview-pane' class='post-reply-split-pane'></div>" +
            "</div>"
        );
    }

    parts.messageBlock.before(splitLayout);
    $("#post-reply-editor-pane").append(parts.messageBlock);
    $("#post-reply-preview-pane").append(parts.previewSection);
    parts.previewBreak.detach();
    parts.postForm.addClass("post-reply-split-enabled");
}


function pasteHandler(e, callback) {

    if (e.clipboardData) {

        var items = e.clipboardData.items;
        if (items) {

            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {

                    var blob = items[i].getAsFile();

                    callback(blob);
                }
            }
        }

    }
}



function upload(file, callback) {
    console.log(file);
    imgurUploadBox.hide();
    imgurUploadingBox.show();

    if (!file) return;

    // Se for um ficheiro HEIC/HEIF, efetuamos a conversão local antes de carregar no Imgur
    if (window.HeicHandler && window.HeicHandler.isHeic(file)) {
        imgurUploadingBox.text("A converter HEIC...").addClass("converting");
        
        window.HeicHandler.convertToJpeg(file)
            .then(function(convertedFile) {
                // Limpa o estado temporário e chama o upload recursivamente com a nova imagem convertida
                imgurUploadingBox.html("&nbsp;").removeClass("converting");
                upload(convertedFile, callback);
            })
            .catch(function(error) {
                // Repõe o botão em caso de falha e alerta o utilizador
                imgurUploadingBox.html("&nbsp;").removeClass("converting").hide();
                imgurUploadBox.show();
                alert("Falha ao processar ficheiro HEIC: " + (error.message || error));
            });
        return;
    }

    if (!file.type.match(/image.*/)) {
        imgurUploadingBox.hide();
        imgurUploadBox.show();
        return;
    }

    var fd = new FormData();
    fd.append("image", file); // Append the file

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.imgur.com/3/upload.json");
    xhr.setRequestHeader('Authorization', 'Client-ID 002bfa2da87f604');
    xhr.timeout = 25000; // 25 seconds timeout

    xhr.ontimeout = function() {
        alert("O upload da imagem falhou: limite de tempo excedido.");
    };

    xhr.onerror = function() {
        alert("O upload da imagem falhou: erro de rede.");
    };

    xhr.onloadend = function() {
        if (xhr.status === 200) {
            callback(JSON.parse(xhr.responseText).data.link);
        } else if (xhr.status !== 0) {
            console.log(xhr);
            alert("Ocorreu um erro durante o upload da imagem (" + xhr.status + ")");
        }

        imgurUploadingBox.hide();
        imgurUploadBox.show();
    };

    xhr.send(fd);
}
