import { uniqueID, ucFirst } from './utils'

const uww = `self.requests = {};
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
    
    if (method === 'PUT') {
        xhr.send(file);
    }
    if (method === 'POST') {
        debugger;
        var formD = new FormData();
        debugger;
        formD.append(file.name, file);
        debugger;
        xhr.send(formD);
        debugger;
    }
    
    
    
    xhr.send(file);
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