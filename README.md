@zdecode/request ![npm version](https://img.shields.io/npm/v/@zdecode/request.svg)

一个简单的请求库封装，支持web/uni-app/原生微信小程序

<!--  -->

## 约定

> 注意：目的是统一不用平台的请求风格和类型的相对统一，约定如下

- `get`请求不支持`data`传递参数, 请使用`params`代替
- 不支持 `httpRequest({...xxx})`方式进行请求,请使用`httpRequest.get({...xxx})`显示声明[请求方法](https://github.com/zhuddan/request/blob/master/dist/shared.d.ts#L4)代替
- 公共参数：
  | 参数 | 说明 |
  | -------- | ------- |
  | baseUrl | 同axios的baseURL |
  | getResponse | 返回原生响应, 而不是服务器自定义返回 |
  | RequestInterceptors | 见 `axios` 拦截器 |

## 如何使用?

> web

1. 安装依赖 `axios` `qs` `@zdecode/request`

```shell
npm i axios qs @zdecode/request
yarn add axios qs @zdecode/request
pnpm add axios qs @zdecode/request
```

2. 声明自定义参数：

```ts
export interface CustomConfig {
/**
 * @description 是否需要token
 */
  withToken?: boolean
};
```

3. 实例化

```ts
import { HttpRequest } from '@zdecode/request'
export const request = new HttpRequest<CustomConfig>({
  baseURL: import.meta.env.VITE_APP_API_URL,
  withToken: true, // 默认值
}, {
  request(config) {
    const token = getCacheToken()
    if (config?.withToken && token)
      config.headers![tokenKey] = `${tokenKeyScheme} ${token}`
    return config
  },

  requestError(e) {
    console.log(e)
  },

  async response(_response) {
    const config = _response.config as RequestConfig<CustomConfig>
    if (config.getResponse) {
      return _response // 返回原生相应
    }
    // 用户自定义返回
    const responseData = _response.data as ResponseResult<object>

    // 用户自定义返回
    if (responseData.code === 200)
      return responseData as any

    const msg = responseData.msg

    return handleError(msg)
  },

  responseError(error) {
    // 错误处理
    throw error
  },
})
```

4. 使用

```ts
import { request } from '@/utils/request/index'
// 登录方法
export function login(data: {
  username: string
  password: string
  code: string
  uuid: string
}) {
  return request.post<{
    token: string
  }>({
    url: '/login',
    data,
    withToken: false,
  })
}
export function login2(data: {
  username: string
  password: string
  code: string
  uuid: string
}) {
  return request.post<{
    token: string
  }>({
    url: '/login',
    data,
    getResponse: true
  })
}

const data = {
  username: 'xxx',
  password: 'xxx',
  code: 'xxx',
  uuid: 'xx',
}
const res1 = await login(data) // ==> ResponseResult<{ token: string }>
const res2 = await login(data) // ==> AxiosResponse<ResponseResult<Api.LoginResponse>, any>
```

[完整示例](https://github.com/zhuddan/request/blob/master/example/vue-example/src/utils/request/index.ts)

> uni-app / 微信小程序

1. 安装依赖 `@zdecode/request`

```shell
npm i @zdecode/request
yarn add @zdecode/request
pnpm add @zdecode/request
```

2. 声明自定义参数：

```ts
export interface CustomConfig {
/**
 * @description 是否需要token
 */
  withToken?: boolean
};
```

3. 实例化

> [!IMPORTANT]
> 请使用 `import { UniRequest } from '@zdecode/request/uni'` 而不是 `import { UniRequest } from '@zdecode/request'` 导入<br>微信小程序同理 使用 `import { WxRequest } from '@zdecode/request/wx'` 而不是 `import { WxRequest } from '@zdecode/request'` 导入

```ts
import { UniRequest } from '@zdecode/request/uni'
// 微信小程序
// import { WxRequest } from '@zdecode/request/wx'

export const request = new UniRequest<HttpRequestUserConfig>({
  baseUrl: '',
  withToken: true,
}, {
  request(_config) {
    const config = Object.assign({
      ..._config,
    }) as RequestConfig<HttpRequestUserConfig>

    if (config.params !== undefined) {
      if (config.method?.toUpperCase() === RequestMethodsEnum.GET) {
        if (!isString(config.params)) {
          const params = removeUndefinedKeys(config.params)
          const _params = Object.assign(params || {}, params || {}, joinTimestamp(true, false))
          config.data = removeUndefinedKeys(_params)
        }
        else {
          config.url = `${config.url + config.params}${joinTimestamp(true, true)}`
        }
      }
      else {
        if (!isString(config.params)) {
          config.url = setParams(config.url as string, Object.assign({}, config.params))
        }
        else {
        // 兼容restful风格
          config.url = config.url + config.params
        }
      }
    }

    /**
     * token
     */
    const token = getCacheToken()
    const whiteUrlPrefix = `${config.baseUrl}/api/`
    const isWhiteUrl = config.url!.startsWith(whiteUrlPrefix)
    const withToken = config.withToken && `${config.withToken}` === 'true'

    if (withToken && !isWhiteUrl) {
      if (token) {
        config.header = {
          [tokenKey]: `${tokenKeyScheme} ${token}`,
          ...config.header,
        }
      }
      else {
        throw new Error('no token')
      }
    }
    return config
  },

  requestError(e) {

  },

  async response({ config, response }) {
    const { data, statusCode } = response
    if (statusCode !== 200) {
      const msg = getSystemErrorMessage(statusCode)
      return handleError(msg)
    }

    if (config.getResponse) {
      return response
    }

    const responseData = data as ResponseResult<object>

    if (responseData.code === 200) {
      return responseData as any
    }

    const msg = responseData.msg || getSystemErrorMessage(responseData.code)
    return handleError(msg, responseData.code !== 401 && !config?.showErrorMsg)
  },

  responseError(error: any) {
    throw error
  },
})
```

4. 使用
   略

[uniapp完整示例](https://github.com/zhuddan/request/blob/master/example/uni-example/src/utils/request/index.ts)

[微信小程序完整示例](https://github.com/zhuddan/request/blob/master/example/wx-example/miniprogram/utils/request/index.ts)

## 备注:

- 为了更好的 ide 支持, 建议使用[typescript](https://www.typescriptlang.org/)
- 微信小程序ts支持需要安装 [miniprogram-api-typings](https://www.npmjs.com/package/miniprogram-api-typings), 小程序内置模板中的类型声明可能过期
- 微信小程序需要 [构建npm](https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html)
- [完整类型声明](https://zhuddan.github.io/request)
- [example](https://github.com/zhuddan/request/tree/master/example/)
