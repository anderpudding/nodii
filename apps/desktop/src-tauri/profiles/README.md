# 프로비저닝 프로파일

Apple Developer에서 받은 **Mac App Store Connect** 프로비저닝 프로파일을 여기에
`Nodii_MAS.provisionprofile` 이름으로 둡니다.

- `*.provisionprofile`은 `.gitignore`에 들어 있어서 커밋되지 않습니다.
- CI에서는 GitHub Secret `MAS_PROVISION_PROFILE`(base64)에서 복원합니다 (8단계).
