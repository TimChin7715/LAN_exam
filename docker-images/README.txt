LAN Exam Docker 绂荤嚎闀滃儚鍖咃紙绠＄悊绔彲灞€鍩熺綉璁块棶锛屼粎楠屾敹/娴嬭瘯锛?
鐢熸垚鏃堕棿: 2026-06-29 17:47:00
鐗堟湰: 1.6.29

鏂囦欢:
  postgres-16.tar     -> docker.io/library/postgres:16
  lan-exam-1.6.29.tar -> lan-exam:1.6.29, lan-exam:latest

绠＄悊鍙? http://<鏈嶅姟鍣↖P>:5180/admin  锛圓DMIN_API_LOOPBACK_ONLY=false锛?

鐩爣鏈哄鍏?
  docker load -i postgres-16.tar
  docker load -i lan-exam-1.6.29.tar
  cd docker-images
  docker compose --env-file .env up -d
