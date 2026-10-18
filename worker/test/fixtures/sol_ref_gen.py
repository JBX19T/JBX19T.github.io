import json, base58, os
from nacl.signing import SigningKey
seed=bytes([5])*32
sk=SigningKey(seed); pub=bytes(sk.verify_key)
def msg_v0(payer):
    # header(1 sig,0 ro signed,1 ro unsigned) + 3 keys + blockhash + 0 instr + 0 lookups
    k2=bytes([9])*32; k3=bytes([8])*32
    return bytes([0x80,1,0,1,3])+payer+k2+k3+bytes([7])*32+bytes([0,0])
def msg_legacy(payer):
    k2=bytes([9])*32
    return bytes([1,0,1,2])+payer+k2+bytes([7])*32+bytes([0])
out={"seed":seed.hex(),"pub58":base58.b58encode(pub).decode(),"key64":base58.b58encode(seed+pub).decode(),"seed58":base58.b58encode(seed).decode(),"json64":list(seed+pub),
 "cases":[]}
for name,m in [("v0",msg_v0(pub)),("legacy",msg_legacy(pub)),("v0_other_payer",msg_v0(bytes([4])*32))]:
    tx=bytes([1])+bytes(64)+m
    out["cases"].append({"name":name,"tx":tx.hex(),"expectedSig":sk.sign(m).signature.hex()})
out["b58tests"]=[[h,base58.b58encode(bytes.fromhex(h)).decode()] for h in ["00","0000ff","ff"*32,"00"*3+"01","" ]]
print(json.dumps(out))
