# 都市ブレードの効果音

素材元：ローカル共有 `../Audio/se/`（JapanMap側資料で効果音ラボ由来として管理している素材）。原本は変更せず、Web用にモノラル44.1kHz・96kbps MP3へ変換し、末尾0.1秒をフェード。必要な尺に短縮。

|用途|元ファイル|同梱ファイル|尺|
|---|---|---|---|
|select|decision1.mp3|select.mp3|0.7秒|
|vs（VS画面への登場）|shakin1.mp3|vs.mp3|1秒|
|launch（発射）|machdash1.mp3|launch.mp3|0.65秒|
|hit|punch-middle2.mp3|hit.mp3|0.4秒|
|critical（味方の会心の一撃）|metal-bat1.mp3|critical.mp3|0.55秒|
|pain（敵の痛恨の一撃）|decision14.mp3|pain.mp3|約1.65秒|
|ringout|buun1.mp3|ringout.mp3|0.65秒|
|break|bomb2.mp3|break.mp3|1.05秒|
|win|success1.mp3|win.mp3|2.4秒|
|lose|cute-sad1.mp3|lose.mp3|1.25秒|
|draw|chan-chan1.mp3|draw.mp3|1.6秒|

クリティカル音は衝突音に埋もれないよう、変換済み素材から音量を4dB上げています（ピークは0dB未満）。再配信時のキャッシュ混在を避けるため、この音源には専用のURLバージョンを付けています。

痛恨の一撃は指定素材を無加工で同梱し、等速で再生します（上記の変換・短縮対象外）。会心の一撃は従来どおりcritical.mp3を再生速度1.12で再生します。
