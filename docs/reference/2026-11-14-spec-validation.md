# METI-3 文档与取证验证记录

验证日期：2026-11-14。此记录只针对规格与参考证据，不宣称博客实现、构建或无障碍测试已通过。

## 已执行

- 逐项读取manifest内全部14个资源，复核文件长度和SHA-256相等；关键CSS145条摘录非空，三份原始HTML与两份CSS均保留。
- 读取computed.json，确认3页×5视口=15份记录；文章/列表每份记录的根scrollWidth均等于视口宽。首页的隐含/未激活作品tab不用于博客卡片尺寸推断。
- 对实际列表的1440/768/761/760/375宽度断言内容宽分别756/704/697/720/335px，列宽分别365×2/339×2/335.5×2/720×1/335×1，均通过。
- 读取states.json，确认真实hover和Tab第二卡焦点的translateY均-5px；dark偏好后body仍白底；reduce偏好后transition为.01s。
- 用捕获base.css在隔离markup验证inline/pre嵌套：pre字号14px，子code字号12.32px/行高20.944px，字距按宽屏.16px、窄屏.15px继承；见cascade.json。
- content-model内的完整JSON示例可被JSON.parse解析；说明其为多文件合并展示，实际文件根形状另行规定。日期示例RFC822星期已与2026-11-14日历核对。
- 对全部对比度按sRGB公式重算；修订#555在完整highlight叠两层网格线的保守对比值为5.12:1。正文#333/白底12.63:1，替换弱字#555/白底7.46:1。
- Git补丁空白检查 `git diff --cached --check`；原始HTTP响应头的CRLF与状态行尾空格保留，取证目录.gitattributes将该文件标为binary以避免Git换行归一化损坏指纹；HTML/CSS也禁用换行归一化。PR只含docs，不改业务实现、ADR、README或下游issue。

## 尚不具备的验证条件

仓库只有文档，无package.json、内容loader、页面或测试套件，因此没有执行npm安装/构建/应用测试，也没有虚构npm通过记录。例文及图片是交给Dev1创建的fixture契约，不是现在已存在、已通过schema的内容资产。

PM仍需批准design-spec第2节的首页映射边界；本轮以in_review交付，不宣布下游可以实现。未来Dev1/Dev2必须执行METI-7与两份规格中的功能、元数据、HTTP、键盘、断点及构建验收。
