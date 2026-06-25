local balancer = require("ngx.balancer")
local cjson    = require("cjson.safe")
local shared   = ngx.shared.autoscaler

local idx = shared:incr("rr_index", 1, 0)

local pool_json = shared:get("active_pool")

if not pool_json then
    pool_json = '[{"id":"instance1","host":"172.20.0.1","port":3001},{"id":"instance2","host":"172.20.0.1","port":3002},{"id":"instance3","host":"172.20.0.1","port":3003}]'
end

local pool = cjson.decode(pool_json)

if not pool or #pool == 0 then
    ngx.log(ngx.ERR, "[balancer] empty pool")
    return ngx.exit(503)
end

local peer = pool[(idx % #pool) + 1]

if not peer or not peer.host or not peer.port then
    ngx.log(ngx.ERR, "[balancer] invalid peer")
    return ngx.exit(502)
end

local ok, err = balancer.set_current_peer(peer.host, peer.port)
if not ok then
    ngx.log(ngx.ERR, "[balancer] set_current_peer failed: ", err)
    return ngx.exit(502)
end