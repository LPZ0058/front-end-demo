export function fileParse(file, type = "base64") {
    return new Promise(resolve => {
        let fileRead = new FileReader();
        if (type === "base64") {
            fileRead.readAsDataURL(file);
        } else if (type === "buffer") {
            fileRead.readAsArrayBuffer(file);
        }
        fileRead.onload = (ev) => {
            // ev.target.result就是对应的base64
            resolve(ev.target.result);
        };
    });
};