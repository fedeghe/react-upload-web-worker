import React, {useState} from 'react'
import Channeljs from '@fedeghe/channeljs'
import { uniqueID } from './utils'
import uploader from './uploader'
import UploadingProgress from './UploadingProgress'


const url = 'http://localhost:3000/upload'
const channelName = 'files'
const channel = Channeljs.get(channelName)


export default () => {
    const [uploads, setUploads] = useState([])
    return <div>
        <input type="file" name="myfile" multiple onChange={e => {
            const files = [...e.target.files]
            const ids = files.map(file => uploader.start({
                method:'POST',
                file,
                url: `${url}?fileName=${file.name}`,
                onStart: data => setUploads(old => [...old, data]),
                onProgress: data => channel.pub(
                    data.id, {
                        type: 'progress',
                        progress: data.progress
                    }
                ),
                onAbort: data => {
                    setUploads(olds => olds.map(
                        old => {
                            if (old.id === data.id){
                                old.aborted = true
                            }
                            return old
                        })
                    )
                    channel.unsub(data.id);
                },
                onEnd: data => {
                    channel.unsub(data.id);
                    setUploads(old => {
                        return old.map(upload => {
                            return upload.id === data.id
                            ? {...upload, percent: 100}
                            : upload
                        })
                    })
                }
            }))
        }}/>
        {uploads.length ? (
            <ul>
                {uploads.map(
                    upload => <li key={`${uniqueID}`}>
                        <UploadingProgress upload={upload}/>
                    </li>
                )}
            </ul>
        ) : null}
        
    </div>
}