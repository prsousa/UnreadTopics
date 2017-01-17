var textarea = $("textarea#message, .quickReplyContent > textarea");
var imgurUploadBox, imgurUploadingBox, fileinput;

if (textarea.length === 1) {
    setUpload();
}


function addImageTag(url) {
    console.log(url);

    var caretPos = textarea[0].selectionStart;
    var textAreaTxt = textarea.val();
    var txtToAdd = "[img]" + url + "[/img]";

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
    var file = files[0];
    var xhr = new XMLHttpRequest();

    if (file.type !== "image/jpg" && file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/gif") {
        alert("Por favor, envia apenas imagens JPG, PNG, ou GIF.");
        return;
    }

    console.log("Drag & Drop");

    upload(file, function(link) {
        addImageTag(link);
    });

    fileinput.val(null);
}

function setUpload() {
    //title='Escolhe ou arrasta uma imagem para a introduzires no post'
    $("<div id='upload' class='imgurBox'>Inserir Imagem</div><div id='uploading' class='imgurBox'>&nbsp;</div><input id='file-input' type='file' name='image' />").insertAfter(textarea);

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

    if (!file || !file.type.match(/image.*/))
        return;

    var fd = new FormData();
    fd.append("image", file); // Append the file

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.imgur.com/3/upload.json");
    xhr.setRequestHeader('Authorization', 'Client-ID 002bfa2da87f604');

    xhr.onloadend = function() {
        if (xhr.status === 200) {
            callback(JSON.parse(xhr.responseText).data.link);
        } else {
            console.log(xhr);
            alert("Ocorreu um erro durante o upload da imagem (" + xhr.status + ")");
        }

        imgurUploadingBox.hide();
        imgurUploadBox.show();
    };

    xhr.send(fd);
}
