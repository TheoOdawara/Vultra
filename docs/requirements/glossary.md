# Glossário

| Termo | Significado |
| --- | --- |
| **Instituição** | Escola ou faculdade que usa o sistema; a unidade de isolamento dos dados. |
| **Pessoa** | Registro mínimo de alguém da instituição que pode ter o rosto cadastrado: identificador externo e nome. |
| **Gestor** | Usuário da instituição que administra pessoas, câmeras e cadastros biométricos. |
| **Professor** | Usuário da instituição responsável por turmas e pelas chamadas delas. |
| **Aluno** | Pessoa matriculada em uma turma; titular do dado, sem acesso ao sistema. |
| **Câmera** | Uma ESP32-CAM registrada em uma instituição, com credencial própria. |
| **Quadro** | A imagem de uma captura, existente apenas em memória durante o processamento. |
| **Captura** | O ato de a câmera obter um quadro e enviá-lo, com a finalidade de cadastro ou de reconhecimento. |
| **Vetor** | Representação numérica do rosto derivada do quadro; o único dado biométrico guardado. |
| **Cadastro biométrico** | O vínculo entre uma pessoa e o vetor do rosto dela. |
| **Galeria** | O conjunto de cadastros biométricos ativos de uma instituição. |
| **Reconhecimento** | Comparação 1:N do vetor de uma captura contra a galeria da instituição. |
| **Evento de reconhecimento** | O registro de um reconhecimento: pessoa, instante, câmera e confiança; sem pessoa quando não há correspondência. |
| **Vivacidade** | Evidência de que o quadro vem de uma pessoa fisicamente presente, e não de foto ou tela. |
| **Emoção** | O rótulo de expressão facial inferido de um quadro, com a confiança da inferência. |
| **Turma** | Grupo de alunos matriculados com um professor responsável. |
| **Sessão de chamada** | O intervalo, aberto e encerrado pelo professor, em que os eventos de uma câmera viram presença de uma turma. |
| **Presença** | O registro de que um aluno esteve em uma sessão de chamada, automático ou manual. |
| **Grupo mínimo** | A quantidade de pessoas distintas abaixo da qual um recorte de emoção agregada é suprimido. |
| **Estágio** | Uma das três etapas de entrega: E1 núcleo, E2 painel, E3 RH. |
