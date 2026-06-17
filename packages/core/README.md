# @zdecode/request

统一API风格的跨平台请求库，支持Web/微信小程序/uni-app/Taro。

# example

```ts
import type { AxiosRequestConfig, Canceler } from 'axios'

import axios, { AxiosError } from 'axios'
import { saveAs } from 'file-saver'
import { isObject, merge } from 'lodash-es'
import type { HttpRequestConfig, ResponseResult } from '@zdecode/request/http'
import {
  ContentTypeEnum,
  HttpRequest,
  RequestMethodsEnum as HttpRequestMethodsEnum,
} from '@zdecode/request'
import { getTokenCookie, removeTokenCookie } from '~/utils/cookie'

export interface CustomConfig {
  /**
   * @description 是否需要token
   */
  withToken?: boolean
  /**
   * @description 忽略重复请求。第一个请求未完成时进行第二个请求，第一个会被被取消
   *              参考 axios 取消请求 https://axios-http.com/zh/docs/cancellation
   */
  ignoreRepeatRequest?: boolean
  /**
   * 下载文件名称
   */
  filename?: string
};

const tokenKey = 'Authorization'
const tokenKeyScheme = 'Bearer'
const cancelMap = new Map<string, Canceler>()

function getHeaderFileName(headers: Record<string, any>) {
  ['file-name', 'download-filename', 'File-Name', 'FileName', 'Filename'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(headers, key)) {
      if (headers[key])
        return `${headers[key]}`
    }
  })
  return ''
}

export const request = new HttpRequest<CustomConfig>({
  baseURL: import.meta.env.VITE_APP_API_URL,
  timeout: 15 * 1000,
  headers: {
    'Content-Type': ContentTypeEnum.JSON,
  },
  getResponse: false,
  ignoreRepeatRequest: false,
  withToken: true,
  onUploadProgress(_progressEvent) {
    // 处理原生进度事件
  },
  // `onDownloadProgress` 允许为下载处理进度事件
  // 浏览器专属
  onDownloadProgress(progressEvent) {
    if (progressEvent.total) {
      const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
      console.log(`Download Progress: ${progress}%`)
    }
  },
}, {
  request(config) {
    /**
     * token
     */
    const token = getTokenCookie()
    if (config?.withToken && token) {
      config.headers![tokenKey] = `${tokenKeyScheme} ${token}`
    }
    /**
     * 忽略重复请求。第一个请求未完成时进行第二个请求，第一个会被被取消
     */
    if (config.ignoreRepeatRequest) {
      const key = generateKey({ ...config })
      const cancelToken = new axios.CancelToken(c => cancelInterceptor(key, c))
      config.cancelToken = cancelToken
    }
    /**
     * 添加时间戳到 get 请求
     */
    if (config.method?.toUpperCase() === HttpRequestMethodsEnum.GET) {
      config.params = { _t: `${Date.now()}`, ...config.params }
    }

    return config
  },

  requestError(e) {
    console.log(e)
  },

  async response(_response) {
    cancelMap.delete(generateKey(_response.config))
    const config = _response.config as HttpRequestConfig<CustomConfig>
    if (config.getResponse) {
      // 处理下载文件
      if (_response.config.responseType === 'blob') {
        const blob = _response.data as unknown as Blob
        const filename = config.filename
        if (_response.data && blob.type !== 'application/json') {
          if (_response.data?.type && !filename) {
            saveAs(_response.data as unknown as Blob)
          }
          else {
            const urlList = config.url?.split('/')
            const extList = config.url?.split('.')
            const urlFileName = urlList && urlList?.length >= 0 ? urlList[urlList?.length - 1] : ''
            const ext = extList && extList?.length >= 0 ? extList[extList?.length - 1] : ''
            const _filename = filename || getHeaderFileName(config.headers || {}) || urlFileName || `${Date.now()}.${ext}`
            saveAs(_response.data, decodeURI(decodeURI(_filename)))
          }
        }
        else {
          const resText = await blob.text()
          const rspObj = JSON.parse(resText)
          return handleError(rspObj.msg || getSystemErrorMessage(rspObj.code))
        }
      }

      return _response
    }
    const responseData = _response.data as ResponseResult<object>

    if (responseData.code === 200) {
      return responseData as any
    }
    /**
     * 登录过期
     */
    if (responseData.code === 401) {
      removeTokenCookie()
    }

    const msg = responseData.msg || getSystemErrorMessage(responseData.code)

    return handleError(msg)
  },

  responseError(error) {
    if (error.config)
      cancelMap.delete(generateKey(error.config))

    if (error instanceof AxiosError) {
      handleError(getAxiosErrorErrorMessage(error.code))
    }

    throw error
  },
})

export function removeAllPenddingRequest() {
  for (const [, value] of cancelMap) {
    value?.('remove all pendding request')
  }
}

function cancelInterceptor(key: string, canceler: Canceler) {
  if (cancelMap.has(key)) {
    cancelMap.get(key)?.('cancel repeat request')
  }
  cancelMap.set(key, canceler)
}

function generateKey(config: AxiosRequestConfig) {
  const { url, method, params = {}, data = {} } = config
  return `${url}-${method}-${JSON.stringify(method === 'get' ? params : data)}`
}

async function handleError(msg: string) {
  console.error(msg)
  // window.showError?.(new Error(msg))
}

function transformRequest(params?: object) {
  if (!isObject(params))
    return ''
  let result = ''
  for (const propName of Object.keys(params)) {
    const value = params[propName as keyof typeof params]
    const part = `${encodeURIComponent(propName)}=`
    if (value !== null && typeof value !== 'undefined') {
      if (typeof value === 'object') {
        for (const key of Object.keys(value)) {
          if (value[key] !== null && typeof value[key] !== 'undefined') {
            const params = `${propName}[${key}]`
            const subPart = `${encodeURIComponent(params)}=`
            result += `${subPart + encodeURIComponent(value[key])}&`
          }
        }
      }
      else {
        result += `${part + encodeURIComponent(value)}&`
      }
    }
  }
  return result
}

export function download(config: Parameters<typeof request.request>[0]) {
  const downloadBaseConfig: typeof config = {
    transformRequest: [
      (params: object) => {
        return transformRequest(params)
      },
    ],
    responseType: 'blob',
    headers: {
      'Content-Type': ContentTypeEnum.FORM_URLENCODED,
    },
    getResponse: true,
  }
  return request.request(merge({ }, downloadBaseConfig, config))
}

function getAxiosErrorErrorMessage(code?: string): string {
  switch (code) {
    case 'ERR_BAD_OPTION_VALUE':
      return '选项设置了错误的值'
    case 'ERR_BAD_OPTION':
      return '无效的或不支持的选项'
    case 'ECONNABORTED':
      return '网络连接被中断，通常因为请求超时'
    case 'ETIMEDOUT':
      return '操作超时'
    case 'ERR_NETWORK':
      return '网络错误'
    case 'ERR_FR_TOO_MANY_REDIRECTS':
      return '请求被重定向了太多次，可能导致无限循环'
    case 'ERR_DEPRECATED':
      return '使用了已被废弃的函数或方法'
    case 'ERR_BAD_RESPONSE':
      return '从服务器接收到无效或错误的响应'
    case 'ERR_BAD_REQUEST':
      return '发送的请求格式错误或无效'
    case 'ERR_CANCELED':
      return '请求已经被取消'
    case 'ERR_NOT_SUPPORT':
      return '使用的某个功能或方法不被支持'
    case 'ERR_INVALID_URL':
      return '提供的URL无效'
    default:
      return '未知错误'
  }
}

function getSystemErrorMessage(status: number) {
  switch (status) {
    case 400:
      return '错误请求，服务器无法理解请求的格式'
    case 401:
      return '无效的会话，或者会话已过期，请重新登录。'
    case 403:
      return '当前操作没有权限'
    case 404:
      return '服务器无法根据客户端的请求找到资源'
    case 405:
      return '网络请求错误,请求方法未允许!'
    case 408:
      return '网络请求超时!'
    case 500:
      return '服务器内部错误，无法完成请求'
    case 502:
      return '网关错误'
    case 503:
      return '服务器目前无法使用（由于超载或停机维护）'
    case 504:
      return '网络超时!'
    case 505:
      return 'http版本不支持该请求!'
    default:
      return '未知错误'
  }
}
```
