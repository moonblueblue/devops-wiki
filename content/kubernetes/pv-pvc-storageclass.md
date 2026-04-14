---
title: "PV, PVC, StorageClass"
date: 2026-04-14
tags:
  - kubernetes
  - storage
  - pv
  - pvc
  - storageclass
  - csi
sidebar_label: "PV·PVC·StorageClass"
---

# PV, PVC, StorageClass

## 1. 스토리지 추상화 구조

```
StorageClass (동적 프로비저너 정의)
      ↕ 프로비저닝
PersistentVolume (실제 스토리지 리소스)
      ↕ 바인딩
PersistentVolumeClaim (스토리지 요청)
      ↕ 마운트
Pod
```

---

## 2. PersistentVolume (PV)

클러스터 관리자가 생성하는 실제 스토리지 리소스다.
동적 프로비저닝을 사용하면 자동으로 생성된다.

### Access Mode

| 모드 | 약자 | 설명 |
|-----|------|------|
| ReadWriteOnce | RWO | 단일 Node에서 읽기/쓰기 |
| ReadOnlyMany | ROX | 다수 Node에서 읽기 |
| ReadWriteMany | RWX | 다수 Node에서 읽기/쓰기 |
| ReadWriteOncePod | RWOP | 단일 Pod에서만 읽기/쓰기 (K8s 1.22+) |

```yaml
# 정적 프로비저닝 (수동)
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
  - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: nfs.example.com
    path: /exports/k8s
```

### Reclaim Policy

| 정책 | 동작 |
|-----|------|
| `Delete` | PVC 삭제 시 PV와 실제 스토리지도 삭제 |
| `Retain` | PVC 삭제 후 PV 유지 (수동 정리 필요) |

---

## 3. PersistentVolumeClaim (PVC)

개발자가 스토리지를 요청하는 인터페이스다.
K8s가 요청 조건에 맞는 PV와 바인딩한다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
  namespace: production
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: fast-ssd    # 특정 StorageClass 지정
  resources:
    requests:
      storage: 50Gi
```

```yaml
# Pod에서 PVC 사용
spec:
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: app-data
  containers:
  - name: app
    volumeMounts:
    - name: data
      mountPath: /data
```

---

## 4. StorageClass

**동적 프로비저닝**을 정의한다.
PVC 생성 시 자동으로 PV와 실제 스토리지를 만들어준다.

```yaml
# AWS EBS gp3
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"  # 기본 SC
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer  # Pod 생성 후 바인딩
```

```yaml
# NFS (멀티 Pod 공유)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-shared
provisioner: nfs.csi.k8s.io
parameters:
  server: nfs.example.com
  share: /exports/k8s
reclaimPolicy: Retain
allowVolumeExpansion: true
```

### volumeBindingMode

| 값 | 동작 |
|---|------|
| `Immediate` | PVC 생성 즉시 바인딩 |
| `WaitForFirstConsumer` | Pod 스케줄링 후 바인딩 (AZ 최적화) |

---

## 5. CSI (Container Storage Interface)

K8s와 스토리지 드라이버를 표준화하는 인터페이스다.
각 벤더가 CSI 드라이버를 구현하여 제공한다.

| 스토리지 | CSI Provisioner |
|---------|----------------|
| AWS EBS | `ebs.csi.aws.com` |
| AWS EFS | `efs.csi.aws.com` |
| GCP Persistent Disk | `pd.csi.storage.gke.io` |
| Azure Disk | `disk.csi.azure.com` |
| NFS | `nfs.csi.k8s.io` |
| Ceph RBD | `rbd.csi.ceph.com` |
| Longhorn | `driver.longhorn.io` |

---

## 6. 볼륨 확장

```bash
# PVC 스토리지 용량 확장
# (StorageClass에 allowVolumeExpansion: true 필요)
kubectl patch pvc app-data -p \
  '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'

# 확인
kubectl get pvc app-data
```

---

## 7. 주요 명령어

```bash
# StorageClass 목록 (기본값 확인)
kubectl get storageclass

# PV 상태
kubectl get pv
# STATUS: Available, Bound, Released, Failed

# PVC 상태
kubectl get pvc -n production
# STATUS: Pending, Bound, Lost

# PVC 상세 (어떤 PV와 바인딩됐는지)
kubectl describe pvc app-data

# 사용량 확인 (Pod 내부)
kubectl exec -it <pod> -- df -h /data
```

---

## 참고 문서

- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [StorageClass](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [CSI](https://kubernetes-csi.github.io/docs/)
- [AWS EBS CSI Driver](https://github.com/kubernetes-sigs/aws-ebs-csi-driver)
