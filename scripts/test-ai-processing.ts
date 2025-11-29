/**
 * AI処理（トリアージ・ドラフト生成）の動作確認スクリプト
 * 
 * 使用方法:
 * npm run test-ai-processing
 */
import * as dotenv from 'dotenv';
import { triageMessage } from '../src/ai/triage';
import { generateDraft } from '../src/ai/draft';

dotenv.config();

async function testAIProcessing() {
  console.log('🧪 AI処理動作確認テスト\n');

  // 1. 環境変数の確認
  console.log('1️⃣ 環境変数の確認...');
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ エラー: 環境変数が設定されていません');
    console.error('   .envファイルに以下を設定してください:');
    console.error('   - OPENAI_API_KEY\n');
    process.exit(1);
  }

  console.log('   ✅ OPENAI_API_KEY: ' + apiKey.substring(0, 10) + '...');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log('   ✅ OPENAI_MODEL: ' + model);
  console.log('');

  // 2. テストメッセージ
  const testMessages = [
    {
      name: '緊急メッセージ（Type A想定）',
      subject: '【緊急】本日の会議について',
      body: '本日の会議が急遽変更になりました。15時から開始となります。ご確認をお願いします。',
      context: undefined
    },
    {
      name: '通常メッセージ（Type B想定）',
      subject: '資料の確認依頼',
      body: '先日お送りした資料について、ご確認いただけますでしょうか。ご質問があればお知らせください。',
      context: undefined
    },
    {
      name: '低優先度メッセージ（Type C想定）',
      subject: 'ニュースレター配信のお知らせ',
      body: '今月のニュースレターを配信いたしました。ぜひご覧ください。',
      context: undefined
    }
  ];

  // 3. トリアージテスト
  console.log('2️⃣ トリアージテスト...\n');
  for (let i = 0; i < testMessages.length; i++) {
    const msg = testMessages[i];
    console.log(`📧 テストメッセージ #${i + 1}: ${msg.name}`);
    console.log(`   件名: ${msg.subject}`);
    console.log(`   本文: ${msg.body.substring(0, 50)}...`);

    try {
      const triageResult = await triageMessage(
        msg.subject,
        msg.body,
        msg.context
      );

      console.log(`   ✅ トリアージ結果:`);
      console.log(`      Type: ${triageResult.type}`);
      console.log(`      Confidence: ${(triageResult.confidence * 100).toFixed(1)}%`);
      console.log(`      Reason: ${triageResult.reason}`);
      console.log(`      Priority Score: ${triageResult.priority_score || 'N/A'}`);
      console.log('');

      // 4. ドラフト生成テスト
      console.log(`3️⃣ ドラフト生成テスト（${msg.name}）...`);
      try {
        const draft = await generateDraft(
          msg.subject,
          msg.body,
          triageResult.type,
          msg.context,
          undefined,
          'formal'
        );

        console.log(`   ✅ 生成されたドラフト:`);
        console.log(`   ${draft.split('\n').map((line: string) => `   ${line}`).join('\n')}`);
        console.log('');
      } catch (draftError: any) {
        console.error(`   ❌ ドラフト生成エラー: ${draftError.message}\n`);
      }

      // 少し待機（APIレート制限対策）
      if (i < testMessages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`   ❌ トリアージエラー: ${error.message}\n`);
    }
  }

  console.log('✅ すべてのテストが完了しました！\n');
}

testAIProcessing().catch((error) => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

