import { uniqueID, ucFirst } from './utils'


const uww = `
(this == undefined ? self : this)['FormData'] = FormData;

var ___send$rw = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype['send'] = function(data) {
    if (data instanceof FormData) {
        if (!data.__endedMultipart) data.__append('--' + data.boundary + '--\r\n');
        data.__endedMultipart = true;
        this.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + data.boundary);
        data = new Uint8Array(data.data).buffer;
    }
    return ___send$rw.call(this, data);
};

function FormData() {
    if (!(this instanceof FormData)) return new FormData();
    this.boundary = '------RWWorkerFormDataBoundary' + Math.random().toString(36);
    var internal_data = this.data = [];
    /**
    * Internal method.
    * @param inp String | ArrayBuffer | Uint8Array  Input
    */
    this.__append = function(inp) {
        var i=0, len;
        if (typeof inp === 'string') {
            for (len=inp.length; i<len; i++)
                internal_data.push(inp.charCodeAt(i) & 0xff);
        } else if (inp && inp.byteLength) {/*If ArrayBuffer or typed array */
            if (!('byteOffset' in inp))   /* If ArrayBuffer, wrap in view */
                inp = new Uint8Array(inp);
            for (len=inp.byteLength; i<len; i++)
                internal_data.push(inp[i] & 0xff);
        }
    };
}
/**
* @param name     String                                  Key name
* @param value    String|Blob|File|Uint8Array|ArrayBuffer Value
* @param filename String                                  Optional File name (when value is not a string).
**/
FormData.prototype['append'] = function(name, value, filename) {
    if (this.__endedMultipart) {
        /* Truncate the closing boundary */
        this.data.length -= this.boundary.length + 6;
        this.__endedMultipart = false;
    }
    var valueType = Object.prototype.toString.call(value),
        part = '--' + this.boundary + '\r\n' + 
            'Content-Disposition: form-data; name="' + name + '"';

    if (/^\[object (?:Blob|File)(?:Constructor)?\]$/.test(valueType)) {
        return this.append(name,
                        new Uint8Array(new FileReaderSync().readAsArrayBuffer(value)),
                        filename || value.name);
    } else if (/^\[object (?:Uint8Array|ArrayBuffer)(?:Constructor)?\]$/.test(valueType)) {
        part += '; filename="'+ (filename || 'blob').replace(/"/g,'%22') +'"\r\n';
        part += 'Content-Type: application/octet-stream\r\n\r\n';
        this.__append(part);
        this.__append(value);
        part = '\r\n';
    } else {
        part += '\r\n\r\n' + value + '\r\n';
    }
    this.__append(part);
};

/* -------------------------------------------------------------- */
self.requests = {};
self.onmessage = event => {
    const {
        data: {
            id, url, file, method, headers,
            action = false
        }
    } = event;
    const { requests } = self;
    if (!action) return;
    switch (action) {
        case 'start-upload': 
            post = true;
            requests[id] = upload({
                id,
                url,
                file,
                headers,
                method, 
                worker: self,
            });
            break;
        case 'abort-upload':
            post = true;
            if (id in requests) {
                requests[id].xhr.abort();
                requests[id].xhr = null;
                delete requests[id];
            }
            break;
        default:
            break;
    }
};
const upload = ({ id, url, file, worker, method, headers = {} }) => {
    const xhr = new XMLHttpRequest(),
        total = file.size,
        progress = e => {
            worker.postMessage({
                action: 'progress',
                id,
                fileName: file.name,
                progress: {
                    percent: ((100 * e.loaded) / total).toFixed(2),
                    loaded: e.loaded,
                    total,
                }
            });
        };
    if (xhr.upload) {
        xhr.upload.addEventListener('progress', progress);
    } else {
        xhr.addEventListener('progress', progress);
    }
    xhr.addEventListener('loadend', () => {
        if ( xhr.status === 200 && xhr.readyState === 4) {
            worker.postMessage({
                action: 'end',
                fileName: file.name,
                id,
            });
        }
    });

    xhr.addEventListener('error', () => {
        worker.postMessage({
            action: 'error',
            id,
            fileName: file.name,
            data: {
                status: xhr.status,
            }
        });
    });
    xhr.addEventListener('abort', () => {
        worker.postMessage({
            action: 'abort',
            id
        });
    });
    
    xhr.open(method, url, true);
    Object.keys(headers).forEach(h => xhr.setRequestHeader(h, headers[h]));

    switch(method) {
        case 'PUT':
            xhr.send(file);    
            break;
        case 'POST':
            var fd = new FormData();
            fd.append(file.name, file, file.name);
            xhr.send(fd);
            break;
    }
    
    worker.postMessage({
        action: 'start',
        id,
        fileName: file.name,
    });
    
    return { xhr };
}`;

const onelinedUww = uww.replace(/\n|\s{2,}/gm, ' ')
const bb = new Blob([onelinedUww], {type: 'text/javascript'}),
    ourUrl = window.webkitURL || window.URL,
    worker = new Worker(ourUrl.createObjectURL(bb)),
    events = ['start', 'progress', 'end', 'error', 'abort'],
    uploader = {
        worker,
        queue: {},
        start: ({file, url, headers, method, ...rest }) => {
            const id = `${uniqueID}`,
                entry = {
                    id,
                    url,
                    file: {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        loaded: 0,
                        percent: 0,
                    },
                    ...(events.reduce((acc, e) => {
                        const n = `on${ucFirst(e)}`;
                        acc[n] = rest[n] || null;
                        return acc;
                    } , {}))
                };
            uploader.queue[id] = entry;
            worker.postMessage({
                action: 'start-upload',
                id, url, file, method, headers
            });
            return id;
        },
        abort: id => {
            worker.postMessage({
                action: 'abort-upload',
                id
            });
        }
    };

uploader.worker.onmessage = e => {
    const {
            data,
            data: {id, action}
        } = e,
        eventer = `on${ucFirst(action)}`,
        upload = uploader.queue[id];
    
    upload
    && events.includes(action)
    && upload[eventer]
    && upload[eventer](data);

    if (eventer === 'onAbort' ){
        if (id in uploader.queue) setTimeout(() => {
            delete uploader.queue[id];
        }, 500)
    }
}

export default uploader