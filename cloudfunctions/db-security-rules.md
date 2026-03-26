# 云数据库安全规则

在云开发控制台 → 数据库 → 点击集合名 → 「权限设置」→「安全规则」粘贴以下规则。

---

## users
> 仅云函数（admin SDK）可读写，前端完全禁止
```json
{
  "read": false,
  "write": false
}
```

---

## shops
> 本人可读写自己的店铺；云函数以 admin 身份绕过此规则
```json
{
  "read":  "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

---

## ingredients
> 仅本人可读写
```json
{
  "read":  "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

---

## stock_logs
> 本人可读自己的日志；写入只允许云函数（admin），前端禁止直接写
> ⚠️ 注意：前端读取 + 云函数写入，所以 write 设 false
>    云函数使用 admin SDK（wx-server-sdk initCloud），不受此规则约束
```json
{
  "read":  "doc._openid == auth.openid",
  "write": false
}
```

---

## recipes
> 仅本人可读写
```json
{
  "read":  "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

---

## collections
> 仅本人可读写
```json
{
  "read":  "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

---

## analytics_snapshots
> 仅云函数（admin）可读写，前端不可读
```json
{
  "read":  false,
  "write": false
}
```
