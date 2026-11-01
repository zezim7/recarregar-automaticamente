# Recarregar automaticamente

Extensão para Chrome que recarrega automaticamente a aba atual no intervalo escolhido: 1 ou 2 minutos. O popup também mostra a data e hora da última recarga automática.

## Instalação no Chrome

1. Extraia `recarregar-automaticamente.zip` para uma pasta.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta extraída `recarregar-automaticamente`.
5. Abra a página que deseja atualizar e clique no ícone da extensão.
6. Escolha **1 minuto** ou **2 minutos** e clique em **Iniciar**.

Para encerrar, abra o popup nessa mesma aba e clique em **Parar**. Cada aba pode ter seu próprio intervalo. Fechar uma aba também encerra o temporizador dela.

A extensão precisa das permissões locais `alarms` e `storage`. Ela não lê o conteúdo da página nem envia dados para a internet. Páginas internas do Chrome, como `chrome://extensions`, não podem ser recarregadas por extensões.
