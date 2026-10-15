// 개발 타입 Unity — AI 가 Unity 프로젝트(C# 스크립트)를 만든다. 씬 파일(YAML)은 AI 가 쓰지 않고,
// 플랫폼이 넣는 편집기 스크립트(VibrexSetup)가 처음 열 때 Main 씬을 만들어 빌드 설정에 넣는다 → 열고 ▶ Play 만 누르면 된다.
// 게임 오브젝트는 전부 런타임에 코드로 만든다(GameBootstrap 의 RuntimeInitializeOnLoadMethod).
import { ENGINE_JOB_MARK, type GodotFile, type GodotProject } from './godot'

export function buildUnitySystemPrompt(): string {
  return `${ENGINE_JOB_MARK}
너는 Unity 게임 개발자다. 사용자의 설명(과 [개발 설정])으로 **Unity 프로젝트의 C# 스크립트**를 만든다. 결과는 사용자가 Unity(6 LTS 또는 2022.3 LTS) 편집기에서 열어 ▶ Play 로 바로 실행한다.

[출력 형식 — 반드시 지킨다]
1) 먼저 한국어로 무엇을 만들었는지 1~3문장 설명 (첫 문장에 「게임 제목」).
2) 그다음 <game> 로 시작해 C# 파일을 아래 형식으로 하나씩 넣고 </game> 로 닫는다. 코드펜스(\`\`\`) 금지, 파일 밖에 다른 글 금지.
<game>
<file path="Assets/Scripts/GameBootstrap.cs">…</file>
<file path="Assets/Scripts/Game.cs">…</file>
</game>
3) 수정 요청이면 **바뀌는 C# 파일만** 출력한다(파일 전체 내용, 또는 그 <file> 안에 SEARCH/REPLACE 블록). 출력하지 않은 파일은 그대로 유지된다.

[프로젝트 규칙 — 패키지·에셋 없이 바로 컴파일·실행되게]
- 파일은 Assets/Scripts/ 아래 C# 만. 2~5개로 간결하게. 필수: Assets/Scripts/GameBootstrap.cs, Assets/Scripts/Game.cs. (Packages/manifest.json, 씬, 편집기 스크립트는 플랫폼이 넣으니 만들지 않는다)
- GameBootstrap.cs 는 정확히 이 형태로 게임을 띄운다(씬에 아무것도 없어도 Play 하면 시작):
using UnityEngine;
public static class GameBootstrap
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (Object.FindFirstObjectByType<Game>() != null) return;
        new GameObject("Game").AddComponent<Game>();
    }
}
- **모든 오브젝트는 코드로 만든다**: Camera(2D 면 orthographic), Light(3D), GameObject.CreatePrimitive(Cube/Sphere/Capsule/Cylinder/Plane/Quad), 2D 는 런타임 Texture2D → Sprite.Create 로 만든 SpriteRenderer. 머티리얼은 new Material(Shader.Find("Sprites/Default")) (2D) 또는 Shader.Find("Standard") (3D, 내장 렌더 파이프라인). 색·조명·파티클(ParticleSystem)·흔들림으로 손맛을 낸다.
- 쓸 수 있는 것: UnityEngine, System, System.Collections(.Generic) 만. **UnityEditor·TextMeshPro·UI(uGUI)·Input System 패키지·URP/HDRP 금지.** 화면 글자(HUD·타이틀)는 OnGUI() 의 GUI.Label/GUIStyle 로 그린다.
- 입력은 기존 Input 클래스만: 이동 Input.GetKey(KeyCode.LeftArrow/RightArrow/UpArrow/DownArrow), jump=KeyCode.Space, fire=KeyCode.A, guard=KeyCode.S, item=KeyCode.D, restart=KeyCode.R. 마우스는 보조로 허용.
- 물리가 필요하면 Rigidbody/Rigidbody2D·Collider 를 코드로 붙인다. 충돌은 OnCollisionEnter(2D) 또는 거리 계산으로.
- 화면 글자는 **짧은 영어**로. 설명 문장(출력 1번)만 한국어.
- 게임 흐름: 타이틀(제목·조작법·"Press Space") → 플레이(점수·목숨/체력 HUD) → 게임오버/클리어("R: Restart"). 난이도는 시간에 따라 오른다.
- **반드시 컴파일돼야 한다**: Unity 6 에서 사라진 API(FindObjectOfType 대신 Object.FindFirstObjectByType, velocity 는 Rigidbody.linearVelocity 가 아닌 2022 호환을 위해 Rigidbody.velocity 를 피하고 직접 transform 이동 권장)를 쓰지 말고, 모든 타입·메서드가 실제로 존재하는지 확인한다.`
}

// 플랫폼이 넣는 고정 파일 — 기본 모듈만 쓰는 manifest, 처음 열 때 Main 씬을 만들어 주는 편집기 스크립트
const MANIFEST = `{
  "dependencies": {
    "com.unity.modules.audio": "1.0.0",
    "com.unity.modules.imgui": "1.0.0",
    "com.unity.modules.particlesystem": "1.0.0",
    "com.unity.modules.physics": "1.0.0",
    "com.unity.modules.physics2d": "1.0.0"
  }
}
`
const SETUP = (title: string) => `// Vibrex 가 넣은 편집기 스크립트 — 처음 열 때 Main 씬을 만들고 빌드 설정에 넣는다. 그다음 ▶ Play 만 누르면 게임이 시작된다.
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
static class VibrexSetup
{
    const string ScenePath = "Assets/Scenes/Main.unity";
    static VibrexSetup() { EditorApplication.delayCall += Setup; }
    static void Setup()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) return;
        if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
        {
            if (!AssetDatabase.IsValidFolder("Assets/Scenes")) AssetDatabase.CreateFolder("Assets", "Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            PlayerSettings.productName = ${JSON.stringify(title)};
        }
        if (SceneManager.GetActiveScene().path != ScenePath && !SceneManager.GetActiveScene().isDirty) EditorSceneManager.OpenScene(ScenePath);
    }
}
#endif
`

const titleOf = (raw: string) => (raw.match(/「([^」]{1,40})」/)?.[1] ?? 'Unity Game').replace(/\s*\(.*\)$/, '').trim()

/** 모델이 낸 C# 파일 + 고정 파일 → 저장할 Unity 프로젝트 (필수 스크립트가 없으면 null) */
export function finishUnityProject(files: GodotFile[], raw: string): GodotProject | null {
  const scripts = files.filter((f) => /^Assets\/Scripts\/[\w\-/]+\.cs$/.test(f.path))
  if (!scripts.some((f) => f.path.endsWith('/Game.cs')) || !scripts.some((f) => f.path.endsWith('/GameBootstrap.cs'))) return null
  const title = titleOf(raw)
  const dimension: '2d' | '3d' = scripts.some((f) => /CreatePrimitive|Shader\.Find\("Standard"\)|\bLight\b/.test(f.content)) && !scripts.some((f) => /orthographic\s*=\s*true|SpriteRenderer/.test(f.content)) ? '3d' : '2d'
  return {
    engine: 'unity', version: 6, dimension, title,
    files: [...scripts, { path: 'Assets/Editor/VibrexSetup.cs', content: SETUP(title) }, { path: 'Packages/manifest.json', content: MANIFEST }],
  }
}
