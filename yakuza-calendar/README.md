# Yakuza Calendar

能在手机日历App订阅的如龙宇宙生日日历

*Powered by Cloudflare Worker*

## 接口说明

### `/`

订阅日历，参数以querystring的形式传入，例：`/?lang=zh-tw`

| 参数名称 | 含义 | 默认值 |
| --- | --- | --- |
| lang | 订阅语言，支持`ja`, `en`, `zh-cn`, `zh-tw`, `ko` | `zh-cn` |
| subTypes | 仅订阅子类型的事项，支持`anniversary`, `birthday` | 全部 |
