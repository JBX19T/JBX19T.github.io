import json
from eth_account import Account
from hyperliquid.utils.signing import (sign_l1_action, action_hash, float_to_wire, order_request_to_order_wire, order_wires_to_order_action)
KEY="0x"+"11"*32
w=Account.from_key(KEY)
out={"address":w.address.lower(),"cases":[],"floats":[]}
def case(name,action,nonce,mainnet):
    sig=sign_l1_action(w,action,None,nonce,None,mainnet)
    out["cases"].append({"name":name,"action":action,"nonce":nonce,"mainnet":mainnet,"hash":"0x"+action_hash(action,None,nonce,None).hex(),"sig":sig})
ow=lambda a,b,p,s,r,t: order_request_to_order_wire({"coin":"X","is_buy":b,"sz":s,"limit_px":p,"order_type":t,"reduce_only":r},a)
ioc={"limit":{"tif":"Ioc"}}
case("ioc_buy_hip3",order_wires_to_order_action([ow(110000,True,4172.5,0.0024,False,ioc)]),1700000000123,False)
case("ioc_sell_mainnet",order_wires_to_order_action([ow(5,False,0.51234,19.0,True,ioc)]),1700000000456,True)
case("sl_tp",order_wires_to_order_action([ow(110001,False,4130.1,0.0024,True,{"trigger":{"isMarket":True,"triggerPx":4130.1,"tpsl":"sl"}}),ow(110001,False,4260,0.0024,True,{"trigger":{"isMarket":True,"triggerPx":4260,"tpsl":"tp"}})]),1700000000789,False)
case("cancel",{"type":"cancel","cancels":[{"a":110000,"o":123456789012}]},1700000000999,False)
case("leverage",{"type":"updateLeverage","asset":110000,"isCross":False,"leverage":3},1700000001111,False)
for x in [100.0,4172.5,0.0024,0.5,1e-8,123.456789,10.0,0.1+0.2,5.0000001]:
    try: out["floats"].append([x,float_to_wire(x)])
    except Exception as e: out["floats"].append([x,"ERR"])
print(json.dumps(out))
