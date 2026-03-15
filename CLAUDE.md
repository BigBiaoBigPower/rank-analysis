# Rank Analysis Agent Team

## 项目概述
英雄联盟排位分析工具，基于 Tauri 2.0 构建
- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Rust (Tauri)
- **核心功能**: LCU API 通信、战绩查询、AI 分析、自动化辅助

---

## Agent Team 多窗口并发协作模式

**重要提示**: Agent Team 支持多窗口/多会话并发执行，可同时启动多个 agents 并行工作。

### 并发工作模式

```
┌─────────────────────────────────────────────────────────────────┐
│                      主 Claude Code 窗口                         │
│                      (总协调 + 代码编辑)                          │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
     ┌─────────▼──────────┐           ┌──────────▼─────────┐
     │  @backend Agent    │           │  @frontend Agent   │
     │  (Rust 开发窗口)    │           │  (Vue/TS 开发窗口)  │
     └─────────┬──────────┘           └──────────┬─────────┘
               │                                  │
     ┌─────────▼──────────┐           ┌──────────▼─────────┐
     │  @reviewer Agent   │           │  @tester Agent     │
     │  (代码审查窗口)     │           │  (测试编写窗口)     │
     └────────────────────┘           └────────────────────┘
```

### 并发启动命令

```bash
# 主窗口执行 - 启动后端开发 Agent
@backend 实现战绩导出功能的 Rust 后端

# 同时在新窗口执行 - 启动前端开发 Agent
@frontend 实现战绩导出的前端界面

# 同时在新窗口执行 - 启动测试编写 Agent
@tester 为战绩导出功能编写单元测试
```

### 多窗口协作最佳实践

1. **任务分解**: 将大任务拆分为独立的子任务，每个 agent 负责一个
2. **接口先行**: @architect 先定义好接口契约，各 agent 按契约并行开发
3. **定期同步**: 各 agent 完成后，@reviewer 统一审查整合
4. **避免冲突**: 不同 agent 应工作在不相干的文件上

---

## Agent Team 配置

### 1. 架构规划师 (architect)
```json
{
  "type": "Plan",
  "description": "软件架构规划",
  "prompt": "你是 Rank Analysis 项目的架构规划师。负责：\n1. 分析新功能的技术可行性\n2. 设计前后端接口契约\n3. 评估技术方案优缺点\n4. 制定实现步骤和优先级\n\n技术栈上下文：\n- 前端: Vue 3 + TypeScript + Pinia + Vue Router\n- 后端: Rust + Tauri + Tokio\n- API: LCU API (League Client Update)\n- 通信: Tauri Commands + Events"
}
```

### 2. 前端专家 (frontend)
```json
{
  "type": "general-purpose",
  "description": "Vue/TypeScript 前端开发",
  "prompt": "你是 Rank Analysis 项目的前端专家。负责：\n1. Vue 3 组件开发与优化\n2. TypeScript 类型定义\n3. Pinia Store 设计\n4. UI/UX 交互实现\n5. 前端性能优化\n\n项目结构：\n- lol-record-analysis-tauri/src/components/ - 组件\n- lol-record-analysis-tauri/src/views/ - 页面\n- lol-record-analysis-tauri/src/pinia/ - 状态管理\n- lol-record-analysis-tauri/src/services/ - API 服务\n- lol-record-analysis-tauri/src/composables/ - 组合式函数\n\n规范：\n- 使用 Composition API + <script setup>\n- 类型定义放在 types/ 目录\n- 组件使用 PascalCase 命名"
}
```

### 3. Rust 专家 (backend)
```json
{
  "type": "general-purpose",
  "description": "Rust 后端开发",
  "prompt": "你是 Rank Analysis 项目的 Rust 专家。负责：\n1. Tauri Commands 实现\n2. LCU API 客户端开发\n3. 异步流程处理 (Tokio)\n4. 错误处理与日志\n5. 性能优化\n\n项目结构：\n- lol-record-analysis-tauri/src-tauri/src/command/ - Tauri Commands\n- lol-record-analysis-tauri/src-tauri/src/lcu/ - LCU API 相关\n- lol-record-analysis-tauri/src-tauri/src/automation.rs - 自动化功能\n- lol-record-analysis-tauri/src-tauri/src/fandom/ - Fandom 数据\n\n规范：\n- 错误处理使用 thiserror/anyhow\n- 异步使用 tokio\n- 日志使用 log crate"
}
```

### 4. 代码审查员 (reviewer)
```json
{
  "type": "general-purpose",
  "description": "代码审查与优化",
  "prompt": "你是 Rank Analysis 项目的代码审查员。负责：\n1. 审查代码质量和规范\n2. 检查潜在bug和安全问题\n3. 提出重构建议\n4. 确保符合项目规范\n\n审查标准：\n- TypeScript: 严格类型检查，无 any\n- Vue: 组件逻辑清晰，props/emits 定义完整\n- Rust: 错误处理完善，避免 unwrap\n- 注释: JSDoc/RustDoc 完整\n- 测试: 单元测试覆盖核心逻辑\n- 通用: DRY原则，可读性，性能"
}
```

### 5. 探索助手 (explorer)
```json
{
  "type": "Explore",
  "description": "代码库探索",
  "prompt": "你是 Rank Analysis 项目的探索助手。负责：\n1. 快速定位代码位置\n2. 分析代码依赖关系\n3. 理解模块职责\n4. 查找示例代码\n\n项目结构参考：\n- 前端源码: lol-record-analysis-tauri/src/\n- 后端源码: lol-record-analysis-tauri/src-tauri/src/\n- 配置: lol-record-analysis-tauri/src-tauri/*.json"
}
```

### 6. 测试专家 (tester)
```json
{
  "type": "general-purpose",
  "description": "单元测试与集成测试",
  "prompt": "你是 Rank Analysis 项目的测试专家。负责：\n1. 编写前端单元测试 (Vitest)\n2. 编写 Rust 单元测试\n3. 设计测试用例和测试数据\n4. 确保核心逻辑有测试覆盖\n\n测试规范：\n- 前端: Vitest + Vue Test Utils\n- Rust: 内置 test 模块 + tokio::test\n- 测试命名: 描述性行为驱动 (should_xxx_when_yyy)\n- 覆盖率: 核心业务逻辑 > 80%"
}
```

### 7. 文档工程师 (documenter)
```json
{
  "type": "general-purpose",
  "description": "技术文档编写",
  "prompt": "你是 Rank Analysis 项目的文档工程师。负责：\n1. 编写 API 文档\n2. 编写架构设计文档\n3. 编写开发指南\n4. 维护 README 和 CHANGELOG\n\n文档规范：\n- API 文档: 参数、返回值、示例、异常说明\n- 架构文档: 流程图、时序图、模块关系\n- 开发指南: 步骤清晰，有代码示例\n- 使用 Markdown，遵循统一格式"
}
```

---

## 代码注释规范

### TypeScript / Vue 注释规范 (JSDoc)

```typescript
/**
 * 计算玩家近期 KDA 数据
 * @param matches - 近期对局列表
 * @param mode - 游戏模式过滤 (可选)
 * @returns KDA 统计对象，包含 kills, deaths, assists, kda
 * @throws 当 matches 为空数组时返回 0/0/0/0
 * @example
 * ```ts
 * const kda = calculateKda(matchHistory.games.games, 420);
 * console.log(kda.kda); // "3.5"
 * ```
 */
export function calculateKda(
  matches: Game[],
  mode?: number
): { kills: number; deaths: number; assists: number; kda: string } {
  // 实现...
}

/**
 * 玩家卡片组件属性
 * @property sessionSummoner - 召唤师会话数据
 * @property team - 所属队伍颜色
 */
interface PlayerCardProps {
  sessionSummoner: SessionSummoner;
  team?: 'blue' | 'red';
}
```

### Rust 注释规范 (RustDoc)

```rust
/// 自动化任务管理器
///
/// 负责管理所有自动化任务的启动、停止和生命周期
///
/// # 示例
/// ```
/// let manager = AutomationManager::new();
/// manager.start_task("accept_match", accept_match_task()).await;
/// ```
pub struct AutomationManager {
    tasks: Arc<Mutex<HashMap<String, AutomationTask>>>,
}

impl AutomationManager {
    /// 启动一个新的自动化任务
    ///
    /// # 参数
    /// - `name`: 任务名称，用于后续管理
    /// - `task`: 异步任务 Future
    ///
    /// # 行为
    /// - 如果同名任务已存在，会先停止旧任务
    /// - 任务会自动加入任务列表管理
    ///
    /// # 示例
    /// ```rust
    /// manager.start_task("auto_accept", async {
    ///     // 自动接受匹配逻辑
    /// }).await;
    /// ```
    pub fn start_task(&self, name: &str, task: impl Future<Output = ()> + Send + 'static) {
        // 实现...
    }
}
```

### 注释检查清单

- [ ] **文件头注释**: 描述文件用途和主要职责
- [ ] **函数/方法注释**: 描述功能、参数、返回值、异常
- [ ] **复杂逻辑注释**: 解释"为什么"而非"做什么"
- [ ] **类型/接口注释**: 描述用途和字段含义
- [ ] **常量注释**: 解释值的来源和用途
- [ ] **TODO/FIXME**: 标记待处理项，附带说明和优先级

---

## 单元测试规范

### 前端测试 (Vitest)

```typescript
// composables/useTheme.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { useTheme } from './useTheme'
import { createPinia, setActivePinia } from 'pinia'

describe('useTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should detect dark mode when theme is Dark', () => {
    // Arrange
    const { isDark } = useTheme()

    // Act & Assert
    expect(isDark.value).toBe(true)
  })

  it('should return correct asset URL for champion', () => {
    const { getChampionUrl } = useAssetUrl()

    const url = getChampionUrl(1)

    expect(url).toContain('/champion/1')
  })
})
```

### Rust 测试

```rust
// command/rank.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn should_calculate_win_rate_correctly() {
        // Arrange
        let wins = 7;
        let losses = 3;

        // Act
        let rate = calculate_win_rate(wins, losses);

        // Assert
        assert_eq!(rate, 70.0);
    }

    #[test]
    fn should_return_zero_when_no_games() {
        assert_eq!(calculate_win_rate(0, 0), 0.0);
    }
}
```

### 测试目录结构

```
lol-record-analysis-tauri/
├── src/
│   ├── composables/
│   │   ├── useTheme.ts
│   │   └── useTheme.spec.ts          # 同目录测试文件
│   ├── services/
│   │   ├── ipc.ts
│   │   └── __tests__/ipc.spec.ts     # 或 __tests__ 目录
│   └── utils/
│       ├── format.ts
│       └── __tests__/format.spec.ts
└── src-tauri/src/
    ├── command/
    │   ├── rank.rs
    │   └── rank_tests.rs             # 子模块测试
    └── lcu/
        └── api/
            └── summoner.rs
```

### 测试覆盖率要求

| 模块类型 | 覆盖率要求 | 说明 |
|---------|-----------|------|
| 工具函数 | 90%+ | format, calculate 等纯函数 |
| Composables | 80%+ | 核心业务逻辑 |
| Services | 70%+ | API 调用（可 mock）|
| Components | 60%+ | 关键交互组件 |
| Rust Commands | 80%+ | 后端核心逻辑 |
| Rust API 客户端 | 70%+ | LCU API 封装 |

---

## 文档规范

### 文档类型

| 文档 | 位置 | 维护者 | 更新时机 |
|------|------|--------|---------|
| README.md | 根目录 | @documenter | 功能变更 |
| ARCHITECTURE.md | docs/ | @architect | 架构变更 |
| API.md | docs/ | @backend | API 变更 |
| CHANGELOG.md | 根目录 | @documenter | 每次发布 |
| CONTRIBUTING.md | 根目录 | @documenter | 流程变更 |

### API 文档模板

```markdown
## get_summoner_by_name

获取召唤师信息

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 召唤师名称（格式: 名称#标签）|

### 返回值

```typescript
interface Summoner {
  gameName: string;      // 游戏名称
  tagLine: string;       // 标签
  puuid: string;         // 唯一标识
  summonerLevel: number; // 等级
  profileIconId: number; // 头像ID
}
```

### 示例

```typescript
const summoner = await invoke('get_summoner_by_name', {
  name: 'PlayerName#1234'
});
```

### 错误

- `SummonerNotFound`: 召唤师不存在
- `InvalidNameFormat`: 名称格式错误
```

---

## 使用示例

### 新功能开发（多窗口并发）

```bash
# 窗口 1: 架构设计
@architect 设计战绩导出功能架构

# 窗口 2: 后端开发（与窗口1同时进行）
@backend 实现战绩导出 API，注意：需要等 architect 的接口设计

# 窗口 3: 前端开发（与窗口2同时进行）
@frontend 实现导出按钮和弹窗

# 窗口 4: 测试编写（与开发同时进行）
@tester 编写导出功能的单元测试

# 窗口 5: 文档编写（与开发同时进行）
@documenter 编写导出功能 API 文档

# 完成后统一审查
@reviewer 审查战绩导出功能的所有代码和测试
```

---

## 项目规范速查

### 文件命名
- Vue 组件: `PascalCase.vue`
- TS 文件: `camelCase.ts`
- Rust 文件: `snake_case.rs`
- 测试文件: `*.spec.ts` 或 `*_tests.rs`

### Git 提交
- 格式: `<type>: <description>`
- Types: feat, fix, refactor, docs, test, chore

### 代码质量
```bash
# 前端检查
cd lol-record-analysis-tauri
npm run lint
npm run format
npm run typecheck
npm run test           # 运行测试

# 后端检查
cd src-tauri
cargo fmt
cargo clippy
cargo test             # 运行测试
```
