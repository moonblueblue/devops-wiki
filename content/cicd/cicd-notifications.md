---
title: "빌드 결과 알림 (Slack, 이메일)"
date: 2026-04-14
tags:
  - cicd
  - notifications
  - slack
  - email
sidebar_label: "빌드 결과 알림"
---

# 빌드 결과 알림

## 1. 알림 설계 원칙

```
알림 피로(Alert Fatigue)를 방지하라

좋은 알림:
  ✓ 실패 시에만 알림
  ✓ 복구(성공) 시 알림
  ✓ 관련자에게만 전달
  ✓ 충분한 컨텍스트 포함

나쁜 알림:
  ✗ 성공할 때마다 알림
  ✗ 누가 무엇을 해야 하는지 불명확
  ✗ 모든 팀에게 일괄 전송
```

---

## 2. GitHub Actions + Slack

### 간단한 Webhook 방식

```yaml
# post 블록에서 알림
post:
  failure:
    - name: Slack 실패 알림
      uses: slackapi/slack-github-action@v2
      with:
        webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
        webhook-type: incoming-webhook
        payload: |
          {
            "text": "❌ 빌드 실패",
            "attachments": [{
              "color": "danger",
              "fields": [
                {"title": "저장소", "value": "${{ github.repository }}", "short": true},
                {"title": "브랜치", "value": "${{ github.ref_name }}", "short": true},
                {"title": "커밋", "value": "${{ github.sha }}", "short": true},
                {"title": "실행자", "value": "${{ github.actor }}", "short": true}
              ],
              "actions": [{
                "text": "빌드 보기",
                "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
              }]
            }]
          }
```

### 성공/실패 모두 처리

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: npm run build

  notify:
    needs: build
    if: always()    # 성공/실패 모두 실행
    runs-on: ubuntu-latest
    steps:
    - name: Slack 알림
      uses: slackapi/slack-github-action@v2
      with:
        webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
        webhook-type: incoming-webhook
        payload: |
          {
            "text": "${{ needs.build.result == 'success' && '✅ 배포 성공' || '❌ 빌드 실패' }}",
            "blocks": [{
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*저장소*: ${{ github.repository }}\n*브랜치*: ${{ github.ref_name }}\n*커밋*: ${{ github.sha }}"
              }
            }]
          }
```

---

## 3. Jenkins + Slack

```groovy
// Jenkinsfile
post {
    success {
        slackSend(
            color: 'good',
            message: """
                ✅ 배포 성공
                Job: ${env.JOB_NAME} #${env.BUILD_NUMBER}
                브랜치: ${env.GIT_BRANCH}
                링크: ${env.BUILD_URL}
            """.stripIndent()
        )
    }
    failure {
        slackSend(
            color: 'danger',
            message: """
                ❌ 빌드 실패
                Job: ${env.JOB_NAME} #${env.BUILD_NUMBER}
                브랜치: ${env.GIT_BRANCH}
                링크: ${env.BUILD_URL}
            """.stripIndent()
        )
    }
}
```

---

## 4. 이메일 알림 (GitHub Actions)

```yaml
- name: 이메일 알림
  uses: dawidd6/action-send-mail@v3
  if: failure()
  with:
    server_address: smtp.gmail.com
    server_port: 587
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: "[${{ github.repository }}] 빌드 실패 - ${{ github.ref_name }}"
    body: |
      브랜치: ${{ github.ref_name }}
      커밋: ${{ github.sha }}
      실행자: ${{ github.actor }}
      
      빌드 링크: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
    to: team@company.com
    from: ci-bot@company.com
```

---

## 5. 배포 알림 모범 사례

```yaml
# 스테이징 배포 성공 알림 (항상)
- name: 스테이징 배포 완료
  uses: slackapi/slack-github-action@v2
  if: success()
  with:
    webhook: ${{ secrets.SLACK_STAGING_WEBHOOK }}
    payload: |
      {
        "text": "🚀 스테이징 배포 완료\n이미지: ${{ needs.build.outputs.image-tag }}\n검증해 주세요: https://staging.example.com"
      }

# 프로덕션 배포는 성공/실패 모두 알림
- name: 프로덕션 배포 알림
  if: always()
  uses: slackapi/slack-github-action@v2
  with:
    webhook: ${{ secrets.SLACK_PROD_WEBHOOK }}
    payload: |
      {
        "text": "${{ job.status == 'success' && '✅ 프로덕션 배포 성공' || '🚨 프로덕션 배포 실패 - 즉시 확인 필요' }}"
      }
```

---

## 6. PagerDuty 연동 (프로덕션 장애)

```yaml
- name: PagerDuty 인시던트 생성
  if: failure() && github.ref == 'refs/heads/main'
  uses: PagerDuty/pagerduty-action@v1
  with:
    pagerduty-integration-key: ${{ secrets.PAGERDUTY_INTEGRATION_KEY }}
    pagerduty-dedup-key: deploy-${{ github.run_id }}
    resolved: false
    title: "프로덕션 배포 실패"
    severity: error
    details: |
      저장소: ${{ github.repository }}
      브랜치: ${{ github.ref_name }}
      빌드: ${{ github.run_id }}
```

---

## 참고 문서

- [slackapi/slack-github-action](https://github.com/slackapi/slack-github-action)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [PagerDuty Events API](https://developer.pagerduty.com/docs/send-alert-event/)
