import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Define the Rwanda CBC (Competence-Based Curriculum) aligned corpus
const corpus = [
    {
        title: 'The Lion and the Mouse - A Rwandan Tale',
        author: 'Traditional (Adapted for P4)',
        language: 'en',
        subject: 'Literature',
        difficulty: 'beginner',
        gradeLevel: 'P4',
        curriculumOutcomeCode: 'P4-ENG-LIT-01',
        content: `Once upon a time in the Akagera National Park, a mighty lion was sleeping under a large acacia tree. A little mouse accidentally ran across his paw and woke him up.

The lion was angry and trapped the mouse under his huge paw. "Please let me go!" cried the mouse. "I am too small to eat, and someday I might be able to help you."

The lion laughed loudly. "How could a tiny mouse like you ever help the king of the savanna?" he asked. But because he was amused, he lifted his paw and let the mouse go.

A few weeks later, the lion was hunting near the river when he stepped into a hunter's trap. A strong net made of rope fell over him. He roared and struggled, but he could not escape.

The little mouse heard the lion roaring and ran to see what was wrong. When he saw the lion in the net, he quickly started to chew on the thick ropes. His sharp teeth bit through one rope, then another, until finally, the lion was free.

"Thank you, little friend," said the lion. "I was wrong to laugh at you. You have saved my life."

The mouse smiled. "Even the smallest friend can be a great help," he replied. From that day on, the lion and the mouse were the best of friends.`,
        simplifyText: true,
        generateAudio: false
    },
    {
        title: 'Le Lion et la Souris - Conte du Rwanda',
        author: 'Traditionnel (Adapté pour P4)',
        language: 'fr',
        subject: 'Literature',
        difficulty: 'beginner',
        gradeLevel: 'P4',
        curriculumOutcomeCode: 'P4-FRE-LIT-01',
        content: `Il était une fois, dans le parc national de l'Akagera, un lion majestueux qui dormait sous un grand acacia. Une petite souris a couru par mégarde sur sa patte et l'a réveillé.

Le lion, en colère, a piégé la souris sous son énorme patte. "S'il te plaît, laisse-moi partir !" cria la souris. "Je suis trop petite pour être mangée, et un jour, je pourrais peut-être t'aider."

Le lion a ri aux éclats. "Comment une toute petite souris comme toi pourrait-elle jamais aider le roi de la savane ?" demanda-t-il. Mais, amusé par cette idée, il a soulevé sa patte et a laissé partir la souris.

Quelques semaines plus tard, le lion chassait près de la rivière lorsqu'il est tombé dans le piège d'un chasseur. Un filet solide fait de cordes s'est abattu sur lui. Il a rugi et s'est débattu, mais il ne pouvait pas s'échapper.

La petite souris a entendu le lion rugir et a couru voir ce qui n'allait pas. Lorsqu'elle a vu le lion dans le filet, elle a rapidement commencé à ronger les épaisses cordes. Ses dents pointues ont coupé une corde, puis une autre, jusqu'à ce que, finalement, le lion soit libre.

"Merci, petite amie," a dit le lion. "J'ai eu tort de me moquer de toi. Tu m'as sauvé la vie."

La souris a souri. "Même le plus petit ami peut être d'une grande aide," a-t-elle répondu. À partir de ce jour, le lion et la souris sont devenus les meilleurs amis du monde.`,
        simplifyText: true,
        generateAudio: false
    },
    {
        title: 'Discovering Kigali',
        author: 'IncludEd Content Team',
        language: 'en',
        subject: 'General',
        difficulty: 'intermediate',
        gradeLevel: 'P5',
        curriculumOutcomeCode: 'P5-ENG-RDG-02',
        content: `Kigali is the capital city of Rwanda. It is built on beautiful rolling hills and valleys. The city is famous for being incredibly clean and safe.

Every last Saturday of the month, the people of Kigali and all across Rwanda participate in 'Umuganda'. This is a day of community service where everyone works together to clean the streets, build houses for the poor, or plant trees. Umuganda brings neighbors together and helps keep the country beautiful.

In the center of Kigali, there are many tall, modern buildings and busy markets. The Kimironko Market is one of the largest and most colorful markets in the city. There, you can buy fresh fruits, vegetables, handmade crafts, and vibrant fabrics.

The city is also home to many important museums and memorials. Kigali is a symbol of peace, progress, and unity in Africa.`,
        simplifyText: true,
        generateAudio: false
    },
    {
        title: 'À la découverte de Kigali',
        author: 'Équipe IncludEd',
        language: 'fr',
        subject: 'General',
        difficulty: 'intermediate',
        gradeLevel: 'P5',
        curriculumOutcomeCode: 'P5-FRE-RDG-02',
        content: `Kigali est la capitale du Rwanda. Elle est construite sur de magnifiques collines et vallées. La ville est réputée pour être incroyablement propre et sûre.

Chaque dernier samedi du mois, les habitants de Kigali et de tout le Rwanda participent à l'"Umuganda". C'est une journée de service communautaire où tout le monde travaille ensemble pour nettoyer les rues, construire des maisons pour les pauvres ou planter des arbres. L'Umuganda réunit les voisins et aide à garder le pays beau.

Au centre de Kigali, il y a de nombreux grands bâtiments modernes et des marchés animés. Le marché de Kimironko est l'un des plus grands et des plus colorés de la ville. On peut y acheter des fruits frais, des légumes, de l'artisanat et des tissus aux couleurs éclatantes.

La ville abrite également de nombreux musées et mémoriaux importants. Kigali est un symbole de paix, de progrès et d'unité en Afrique.`,
        simplifyText: true,
        generateAudio: false
    }
];

async function seedCorpus() {
    const API_URL = 'http://localhost:3000';
    const token = 'dev-admin'; // Using the development bypass token

    console.log('🚀 Starting Rwanda corpus seeding using dev-admin bypass...');

    for (const item of corpus) {
        console.log(`\nUploading: ${item.title} (${item.language})`);
        try {
            const formData = new FormData();
            formData.append('title', item.title);
            formData.append('author', item.author);
            formData.append('language', item.language === 'en' ? 'english' : 'french');
            formData.append('subject', item.subject);
            formData.append('difficulty', item.difficulty);
            formData.append('gradeLevel', item.gradeLevel);
            formData.append('curriculumOutcomeCode', item.curriculumOutcomeCode);
            formData.append('content', item.content);
            formData.append('simplifyText', 'true');
            formData.append('generateAudio', 'false');

            const response = await axios.post(`${API_URL}/api/literature/upload`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log(`✅ Success: ${response.data.title} (ID: ${response.data.id})`);
        } catch (error) {
            console.error(`❌ Failed to upload ${item.title}:`);
            if (error.response) {
                console.error(error.response.data);
            } else {
                console.error(error.message);
            }
        }
    }
}

seedCorpus().then(() => {
    console.log('\n🎉 Rwanda-aligned EN/FR corpus seeding complete!');
    process.exit(0);
});
